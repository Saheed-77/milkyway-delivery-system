-- =============================================================================
-- MilkyWay — map-based delivery: locations, dispatch, live tracking, OTP
-- proof-of-delivery and subscription billing.
--
-- Apply after 20260711000001_secure_rebuild.sql. Idempotent where practical.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists latitude double precision
    check (latitude is null or latitude between -90 and 90),
  add column if not exists longitude double precision
    check (longitude is null or longitude between -180 and 180);

alter table public.orders
  add column if not exists delivery_address text,
  add column if not exists delivery_lat double precision
    check (delivery_lat is null or delivery_lat between -90 and 90),
  add column if not exists delivery_lng double precision
    check (delivery_lng is null or delivery_lng between -180 and 180),
  add column if not exists delivery_notes text check (char_length(delivery_notes) <= 500),
  add column if not exists assigned_at timestamptz,
  add column if not exists picked_up_at timestamptz,
  add column if not exists source text not null default 'order'
    check (source in ('order', 'subscription')),
  add column if not exists subscription_id uuid references public.subscriptions (id) on delete set null;

create index if not exists idx_orders_rider_status on public.orders (delivery_person_id, status);
create index if not exists idx_orders_subscription on public.orders (subscription_id, created_at);

-- Remove duplicates left by the old UI before adding uniqueness (keep newest).
delete from public.milk_pricing a
using public.milk_pricing b
where a.milk_type = b.milk_type
  and a.effective_from = b.effective_from
  and (a.created_at, a.ctid) < (b.created_at, b.ctid);

delete from public.stock_reservations a
using public.stock_reservations b
where a.reservation_date = b.reservation_date
  and a.reservation_type = b.reservation_type
  and (a.created_at, a.ctid) < (b.created_at, b.ctid);

-- One price row per milk type per effective date; history is kept by date.
create unique index if not exists uq_milk_pricing_type_date
  on public.milk_pricing (milk_type, effective_from);

-- One subscription reservation per day (makes auto-reserve idempotent).
create unique index if not exists uq_reservation_date_type
  on public.stock_reservations (reservation_date, reservation_type);

-- ---------------------------------------------------------------------------
-- 2. New tables
-- ---------------------------------------------------------------------------

-- Delivery OTPs live in their own table so delivery staff (who can read all
-- orders) never see them; only the ordering customer can.
create table if not exists public.order_otps (
  order_id uuid primary key references public.orders (id) on delete cascade,
  otp text not null check (otp ~ '^[0-9]{4}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.depots (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null default '',
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.rider_locations (
  rider_id uuid primary key references public.profiles (id) on delete cascade,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  heading double precision,
  speed double precision,
  updated_at timestamptz not null default now()
);

alter table public.order_otps enable row level security;
alter table public.depots enable row level security;
alter table public.rider_locations enable row level security;

-- ---------------------------------------------------------------------------
-- 3. RLS
-- ---------------------------------------------------------------------------
drop policy if exists "customer reads own otp" on public.order_otps;
create policy "customer reads own otp" on public.order_otps
  for select using (
    exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid())
  );

drop policy if exists "authenticated read depots" on public.depots;
create policy "authenticated read depots" on public.depots
  for select to authenticated using (true);
drop policy if exists "admin manages depots" on public.depots;
create policy "admin manages depots" on public.depots
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin reads rider locations" on public.rider_locations;
create policy "admin reads rider locations" on public.rider_locations
  for select using (public.is_admin());
drop policy if exists "rider reads own location" on public.rider_locations;
create policy "rider reads own location" on public.rider_locations
  for select using (rider_id = auth.uid());
-- Customers see their rider only while one of their orders is in progress.
drop policy if exists "customer reads assigned rider location" on public.rider_locations;
create policy "customer reads assigned rider location" on public.rider_locations
  for select using (
    exists (
      select 1 from public.orders o
      where o.delivery_person_id = rider_id
        and o.customer_id = auth.uid()
        and o.status in ('pending', 'out_for_delivery')
    )
  );

-- Customers may read the name/phone of the rider delivering their order.
drop policy if exists "customer reads assigned rider profile" on public.profiles;
create policy "customer reads assigned rider profile" on public.profiles
  for select using (
    user_type = 'delivery'
    and exists (
      select 1 from public.orders o
      where o.delivery_person_id = profiles.id
        and o.customer_id = auth.uid()
        and o.status in ('pending', 'out_for_delivery', 'completed')
    )
  );

-- Admins may read farmer/customer wallet history already; nothing else changes.

-- ---------------------------------------------------------------------------
-- 4. Helpers
-- ---------------------------------------------------------------------------
create or replace function public.distance_m(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
)
returns double precision
language sql immutable
set search_path = public, pg_temp
as $$
  select 2 * 6371000 * asin(least(1, sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  )))
$$;

create or replace function public.new_delivery_otp()
returns text
language sql volatile
set search_path = public, pg_temp
as $$
  select lpad((floor(random() * 9000) + 1000)::int::text, 4, '0')
$$;

-- ---------------------------------------------------------------------------
-- 5. place_order — now with a delivery location and OTP
-- ---------------------------------------------------------------------------
drop function if exists public.place_order(text, numeric, text);

create or replace function public.place_order(
  p_milk_type text,
  p_quantity numeric,
  p_payment_method text,
  p_address text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_notes text default null
)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_product public.products;
  v_profile public.profiles;
  v_total numeric;
  v_balance numeric;
  v_order_id uuid;
  v_stock_row public.milk_stock;
  v_reserved numeric;
  v_milk public.milk_kind;
  v_method public.payment_method;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_quantity is null or p_quantity <= 0 or p_quantity > 100 then
    raise exception 'Quantity must be between 1 and 100';
  end if;
  if (p_lat is null) <> (p_lng is null)
     or (p_lat is not null and (p_lat not between -90 and 90 or p_lng not between -180 and 180)) then
    raise exception 'Invalid delivery location';
  end if;

  begin
    v_milk := p_milk_type::public.milk_kind;
    v_method := p_payment_method::public.payment_method;
  exception when others then
    raise exception 'Invalid milk type or payment method';
  end;

  select * into v_profile from public.profiles where id = auth.uid();

  select * into v_product
  from public.products
  where milk_type = v_milk and is_active
  order by price
  limit 1;

  if v_product.id is null then
    raise exception 'No % milk products available', p_milk_type;
  end if;

  v_total := round(v_product.price * p_quantity, 2);

  select * into v_stock_row
  from public.milk_stock
  where date = current_date
  for update;

  select coalesce(sum(reserved_amount), 0) into v_reserved
  from public.stock_reservations
  where reservation_date = current_date;

  if v_stock_row.id is null
     or (v_stock_row.total_stock - v_reserved) < p_quantity then
    raise exception 'Insufficient stock available today';
  end if;

  if v_method = 'wallet' then
    perform pg_advisory_xact_lock(hashtext(auth.uid()::text));

    select coalesce(sum(
      case transaction_type when 'deposit' then amount else -amount end
    ), 0) into v_balance
    from public.wallet_transactions
    where user_id = auth.uid() and status = 'completed';

    if v_balance < v_total then
      raise exception 'Insufficient wallet balance. Need ₹% more.',
        to_char(v_total - v_balance, 'FM999999990.00');
    end if;
  end if;

  insert into public.orders (
    customer_id, total_amount, status, payment_method,
    delivery_address, delivery_lat, delivery_lng, delivery_notes, source
  )
  values (
    auth.uid(), v_total, 'pending', v_method,
    coalesce(nullif(trim(p_address), ''), v_profile.address),
    coalesce(p_lat, v_profile.latitude),
    coalesce(p_lng, v_profile.longitude),
    nullif(trim(p_notes), ''),
    'order'
  )
  returning id into v_order_id;

  insert into public.order_items (order_id, product_id, quantity, unit_price)
  values (v_order_id, v_product.id, p_quantity, v_product.price);

  insert into public.order_otps (order_id, otp) values (v_order_id, public.new_delivery_otp());

  if v_method = 'wallet' then
    insert into public.wallet_transactions
      (user_id, amount, transaction_type, status, description, order_id)
    values
      (auth.uid(), v_total, 'withdrawal', 'completed', 'Order payment', v_order_id);
  end if;

  update public.milk_stock
  set total_stock = total_stock - p_quantity, updated_at = now()
  where id = v_stock_row.id;

  return v_order_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Dispatch & delivery RPCs
-- ---------------------------------------------------------------------------
drop function if exists public.complete_delivery(uuid);

-- Riders must present the customer's OTP; admins may force-complete.
create or replace function public.complete_delivery(p_order_id uuid, p_otp text default null)
returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders;
  v_otp text;
begin
  if not (public.is_delivery() or public.is_admin()) then
    raise exception 'Only delivery staff may complete deliveries';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;

  if v_order.id is null then
    raise exception 'Order not found';
  end if;
  if v_order.status not in ('pending', 'out_for_delivery') then
    raise exception 'Order is not deliverable (status: %)', v_order.status;
  end if;

  if not public.is_admin() then
    if v_order.delivery_person_id is not null and v_order.delivery_person_id <> auth.uid() then
      raise exception 'This order is not assigned to you';
    end if;
    select otp into v_otp from public.order_otps where order_id = p_order_id;
    if v_otp is not null and coalesce(trim(p_otp), '') <> v_otp then
      raise exception 'Incorrect delivery code — ask the customer for the 4-digit code';
    end if;
  end if;

  update public.orders
  set status = 'completed',
      delivery_person_id = coalesce(delivery_person_id, auth.uid()),
      delivered_at = now()
  where id = p_order_id;

  return true;
end;
$$;

create or replace function public.claim_order(p_order_id uuid)
returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_delivery() then
    raise exception 'Only delivery staff may claim orders';
  end if;

  update public.orders
  set delivery_person_id = auth.uid(), assigned_at = now()
  where id = p_order_id and status = 'pending' and delivery_person_id is null;

  if not found then
    raise exception 'This order was already taken';
  end if;
  return true;
end;
$$;

create or replace function public.assign_order(p_order_id uuid, p_rider_id uuid)
returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins may assign orders';
  end if;
  if p_rider_id is not null and coalesce(public.current_role_of(p_rider_id)::text, '') <> 'delivery' then
    raise exception 'Rider not found';
  end if;

  update public.orders
  set delivery_person_id = p_rider_id,
      assigned_at = case when p_rider_id is null then null else now() end
  where id = p_order_id and status = 'pending';

  if not found then
    raise exception 'Only pending orders can be (re)assigned';
  end if;
  return true;
end;
$$;

-- Nearest rider (by last known position, else the depot) with spare capacity.
create or replace function public.auto_assign_orders(p_max_per_rider integer default 6)
returns integer
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_order record;
  v_rider uuid;
  v_count integer := 0;
  v_depot public.depots;
begin
  if not public.is_admin() then
    raise exception 'Only admins may dispatch orders';
  end if;

  select * into v_depot from public.depots where is_active order by created_at limit 1;

  for v_order in
    select id, delivery_lat, delivery_lng
    from public.orders
    where status = 'pending' and delivery_person_id is null
      and delivery_lat is not null and delivery_lng is not null
    order by created_at
    for update skip locked
  loop
    select p.id into v_rider
    from public.profiles p
    left join public.rider_locations l on l.rider_id = p.id
    left join lateral (
      select count(*) as active
      from public.orders o
      where o.delivery_person_id = p.id and o.status in ('pending', 'out_for_delivery')
    ) a on true
    where p.user_type = 'delivery' and p.status = 'approved'
      and a.active < p_max_per_rider
    order by public.distance_m(
               coalesce(l.lat, v_depot.lat), coalesce(l.lng, v_depot.lng),
               v_order.delivery_lat, v_order.delivery_lng
             ) + a.active * 800
    limit 1;

    exit when v_rider is null;

    update public.orders
    set delivery_person_id = v_rider, assigned_at = now()
    where id = v_order.id;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create or replace function public.start_delivery(p_order_id uuid)
returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_delivery() then
    raise exception 'Only delivery staff may start deliveries';
  end if;

  update public.orders
  set status = 'out_for_delivery', picked_up_at = now()
  where id = p_order_id and delivery_person_id = auth.uid() and status = 'pending';

  if not found then
    raise exception 'Order cannot be started — it is not a pending stop assigned to you';
  end if;
  return true;
end;
$$;

create or replace function public.update_rider_location(
  p_lat double precision,
  p_lng double precision,
  p_heading double precision default null,
  p_speed double precision default null
)
returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_delivery() then
    raise exception 'Only delivery staff share a location';
  end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Invalid location';
  end if;

  insert into public.rider_locations (rider_id, lat, lng, heading, speed, updated_at)
  values (auth.uid(), p_lat, p_lng, p_heading, p_speed, now())
  on conflict (rider_id) do update
    set lat = excluded.lat, lng = excluded.lng, heading = excluded.heading,
        speed = excluded.speed, updated_at = now();
  return true;
end;
$$;

-- One call for the customer tracking page.
create or replace function public.get_order_tracking(p_order_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders;
  v_rider public.profiles;
  v_loc public.rider_locations;
  v_depot public.depots;
  v_otp text;
begin
  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null
     or not (v_order.customer_id = auth.uid()
             or public.is_admin()
             or (public.is_delivery() and v_order.delivery_person_id = auth.uid())) then
    raise exception 'Order not found';
  end if;

  if v_order.customer_id = auth.uid() then
    select otp into v_otp from public.order_otps where order_id = p_order_id;
  end if;

  if v_order.delivery_person_id is not null then
    select * into v_rider from public.profiles where id = v_order.delivery_person_id;
    if v_order.status in ('pending', 'out_for_delivery') then
      select * into v_loc from public.rider_locations where rider_id = v_order.delivery_person_id;
    end if;
  end if;

  select * into v_depot from public.depots where is_active order by created_at limit 1;

  return jsonb_build_object(
    'otp', v_otp,
    'rider', case when v_rider.id is null then null else jsonb_build_object(
      'id', v_rider.id,
      'name', concat_ws(' ', v_rider.first_name, v_rider.last_name),
      'phone', v_rider.phone) end,
    'location', case when v_loc.rider_id is null then null else jsonb_build_object(
      'rider_id', v_loc.rider_id, 'lat', v_loc.lat, 'lng', v_loc.lng,
      'heading', v_loc.heading, 'speed', v_loc.speed, 'updated_at', v_loc.updated_at) end,
    'depot', case when v_depot.id is null then null else jsonb_build_object(
      'id', v_depot.id, 'name', v_depot.name, 'address', v_depot.address,
      'lat', v_depot.lat, 'lng', v_depot.lng) end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Subscription billing → delivery orders
-- ---------------------------------------------------------------------------
create or replace function public.generate_subscription_orders(p_date date default current_date)
returns integer
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  s record;
  v_product public.products;
  v_profile public.profiles;
  v_total numeric;
  v_balance numeric;
  v_order_id uuid;
  v_count integer := 0;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Only admins may generate subscription orders';
  end if;

  for s in
    select * from public.subscriptions
    where status = 'active'
      and (frequency = 'daily'
           or (frequency = 'weekly' and extract(dow from created_at) = extract(dow from p_date))
           or (frequency = 'monthly' and extract(day from created_at) = extract(day from p_date)))
  loop
    continue when exists (
      select 1 from public.orders o
      where o.subscription_id = s.id and o.created_at::date = p_date
    );

    select * into v_product from public.products where id = s.product_id and is_active;
    if v_product.id is null then
      select * into v_product from public.products
      where milk_type = s.milk_type and is_active order by price limit 1;
    end if;
    continue when v_product.id is null;

    select * into v_profile from public.profiles where id = s.customer_id;
    v_total := round(v_product.price * s.quantity, 2);

    perform pg_advisory_xact_lock(hashtext(s.customer_id::text));
    select coalesce(sum(case transaction_type when 'deposit' then amount else -amount end), 0)
      into v_balance
    from public.wallet_transactions
    where user_id = s.customer_id and status = 'completed';
    continue when v_balance < v_total; -- skipped: low balance

    insert into public.orders (
      customer_id, total_amount, status, payment_method,
      delivery_address, delivery_lat, delivery_lng, source, subscription_id
    )
    values (
      s.customer_id, v_total, 'pending', 'wallet',
      v_profile.address, v_profile.latitude, v_profile.longitude, 'subscription', s.id
    )
    returning id into v_order_id;

    insert into public.order_items (order_id, product_id, quantity, unit_price)
    values (v_order_id, v_product.id, s.quantity, v_product.price);
    insert into public.order_otps (order_id, otp) values (v_order_id, public.new_delivery_otp());
    insert into public.wallet_transactions
      (user_id, amount, transaction_type, status, description, order_id)
    values (s.customer_id, v_total, 'withdrawal', 'completed', 'Subscription delivery', v_order_id);

    update public.milk_stock
    set total_stock = greatest(0, total_stock - s.quantity), updated_at = now()
    where date = p_date;
    update public.stock_reservations
    set reserved_amount = greatest(0, reserved_amount - s.quantity)
    where reservation_date = p_date and reservation_type = 'subscription';

    update public.subscriptions
    set next_delivery = p_date + case frequency when 'daily' then 1 when 'weekly' then 7 else 30 end
    where id = s.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- auto_reserve_subscription_stock used "on conflict do nothing" without a
-- unique constraint, so repeated clicks inserted duplicates. Now idempotent.
create or replace function public.auto_reserve_subscription_stock()
returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_demand numeric := 0;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Only admins may manage reservations';
  end if;

  select coalesce(sum(
    case s.frequency
      when 'daily' then s.quantity
      when 'weekly' then s.quantity / 7
      when 'monthly' then s.quantity / 30
    end), 0) into v_demand
  from public.subscriptions s
  where s.status = 'active';

  insert into public.stock_reservations (reservation_date, reserved_amount, reservation_type)
  values (current_date + 1, ceiling(v_demand), 'subscription')
  on conflict (reservation_date, reservation_type)
  do update set reserved_amount = excluded.reserved_amount;

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Realtime
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array[
      'orders', 'rider_locations', 'wallet_transactions', 'farmer_payments',
      'milk_contributions', 'milk_stock', 'profiles', 'subscriptions'
    ] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Grants
-- ---------------------------------------------------------------------------
revoke execute on function
  public.place_order(text, numeric, text, text, double precision, double precision, text),
  public.complete_delivery(uuid, text),
  public.claim_order(uuid),
  public.assign_order(uuid, uuid),
  public.auto_assign_orders(integer),
  public.start_delivery(uuid),
  public.update_rider_location(double precision, double precision, double precision, double precision),
  public.get_order_tracking(uuid),
  public.generate_subscription_orders(date),
  public.new_delivery_otp()
from public, anon;

grant execute on function
  public.place_order(text, numeric, text, text, double precision, double precision, text),
  public.complete_delivery(uuid, text),
  public.claim_order(uuid),
  public.assign_order(uuid, uuid),
  public.auto_assign_orders(integer),
  public.start_delivery(uuid),
  public.update_rider_location(double precision, double precision, double precision, double precision),
  public.get_order_tracking(uuid),
  public.generate_subscription_orders(date),
  public.distance_m(double precision, double precision, double precision, double precision)
to authenticated;

-- ---------------------------------------------------------------------------
-- 10. Seed: default depot (edit to your hub's location)
-- ---------------------------------------------------------------------------
insert into public.depots (name, address, lat, lng)
select 'MilkyWay Hub', 'Kaloor, Kochi', 9.9971, 76.2996
where not exists (select 1 from public.depots);

-- Optional (pg_cron): bill subscriptions every morning at 05:00.
-- select cron.schedule('subscription-orders', '0 5 * * *',
--   $$select public.generate_subscription_orders(current_date)$$);
