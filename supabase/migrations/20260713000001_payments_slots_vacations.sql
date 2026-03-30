-- =============================================================================
-- MilkyWay — online payments (Razorpay-shaped, test mode), delivery time
-- slots, and subscription vacations / skip-a-day.
--
-- Apply after 20260712000001_delivery_maps.sql.
--
-- PAYMENTS ARE TEST MODE: capture_test_payment() trusts the client's
-- "payment succeeded" call, exactly like the demo recharge did. For real money,
-- create orders and verify payments server-side with Razorpay (Edge Function +
-- webhook with X-Razorpay-Signature verification) and disable test captures:
--   alter database postgres set app.allow_test_payments = 'off';
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Types & columns
-- ---------------------------------------------------------------------------
alter type public.payment_method add value if not exists 'online';

-- Local timezone used for slot times (edit for other regions).
create or replace function public.app_tz()
returns text
language sql immutable
as $$ select 'Asia/Kolkata' $$;

create table if not exists public.gateway_payments (
  gateway_order_id text primary key,                 -- order_XXXXXXXXXXXXXX
  payment_id text unique,                            -- pay_XXXXXXXXXXXXXX (on capture/failure)
  user_id uuid not null references public.profiles (id),
  amount numeric not null check (amount >= 1 and amount <= 100000),
  purpose text not null check (purpose in ('wallet_topup', 'order')),
  method text check (method in ('upi', 'card', 'netbanking', 'wallet')),
  method_detail text check (char_length(method_detail) <= 80),
  status text not null default 'created' check (status in ('created', 'captured', 'failed', 'refunded')),
  failure_reason text check (char_length(failure_reason) <= 160),
  order_id uuid references public.orders (id),
  created_at timestamptz not null default now(),
  captured_at timestamptz,
  refunded_at timestamptz
);
create index if not exists idx_gateway_user on public.gateway_payments (user_id, created_at desc);

alter table public.delivery_slots
  add column if not exists is_active boolean not null default true;
create unique index if not exists uq_delivery_slot_window on public.delivery_slots (slot_date, start_time);

alter table public.orders
  add column if not exists delivery_slot_id uuid references public.delivery_slots (id),
  add column if not exists gateway_payment_id text references public.gateway_payments (payment_id);
create index if not exists idx_orders_slot on public.orders (delivery_slot_id) where status <> 'cancelled';

alter table public.subscriptions
  add column if not exists preferred_slot_start time;

create table if not exists public.subscription_skips (
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  skip_date date not null,
  created_at timestamptz not null default now(),
  primary key (subscription_id, skip_date)
);

-- ---------------------------------------------------------------------------
-- 2. RLS (reads only — all writes go through the RPCs below)
-- ---------------------------------------------------------------------------
alter table public.gateway_payments enable row level security;
alter table public.subscription_skips enable row level security;

drop policy if exists "read own gateway payments" on public.gateway_payments;
create policy "read own gateway payments" on public.gateway_payments
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "read own subscription skips" on public.subscription_skips;
create policy "read own subscription skips" on public.subscription_skips
  for select using (
    public.is_admin()
    or exists (select 1 from public.subscriptions s where s.id = subscription_id and s.customer_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 3. Helpers
-- ---------------------------------------------------------------------------
create or replace function public.new_gateway_id(p_prefix text)
returns text
language sql volatile
set search_path = public, pg_temp
as $$
  select p_prefix || '_' || substr(md5(random()::text || clock_timestamp()::text), 1, 14)
$$;

create or replace function public.slot_starts_at(p_date date, p_start time)
returns timestamptz
language sql stable
set search_path = public, pg_temp
as $$ select (p_date + p_start) at time zone public.app_tz() $$;

create or replace function public.subscription_due_on(s public.subscriptions, p_date date)
returns boolean
language sql stable
set search_path = public, pg_temp
as $$
  select p_date >= (s.created_at at time zone public.app_tz())::date
     and (s.frequency = 'daily'
          or (s.frequency = 'weekly' and extract(dow from s.created_at at time zone public.app_tz()) = extract(dow from p_date))
          or (s.frequency = 'monthly' and extract(day from p_date) = least(
                extract(day from s.created_at at time zone public.app_tz()),
                extract(day from (date_trunc('month', p_date) + interval '1 month - 1 day')))))
$$;

-- Materialise the default windows (06–08, 08–10, 17–19, 19–21) for a range.
create or replace function public.ensure_delivery_slots(p_from date, p_days integer)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.delivery_slots (slot_date, start_time, end_time, capacity)
  select d::date, w.s, w.e, 25
  from generate_series(p_from, p_from + (least(greatest(p_days, 1), 14) - 1), interval '1 day') d
  cross join (values ('06:00'::time, '08:00'::time), ('08:00', '10:00'), ('17:00', '19:00'), ('19:00', '21:00')) w(s, e)
  on conflict (slot_date, start_time) do nothing;
end;
$$;

create or replace function public.get_delivery_slots(p_from date, p_days integer default 4)
returns table (
  id uuid, slot_date date, start_time time, end_time time,
  capacity integer, is_active boolean, booked integer, available boolean
)
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  perform public.ensure_delivery_slots(p_from, p_days);
  return query
  select ds.id, ds.slot_date, ds.start_time, ds.end_time, ds.capacity, ds.is_active,
         b.n::integer,
         ds.is_active and b.n < ds.capacity
           and public.slot_starts_at(ds.slot_date, ds.start_time) - interval '30 minutes' > now()
  from public.delivery_slots ds
  left join lateral (
    select count(*) as n from public.orders o
    where o.delivery_slot_id = ds.id and o.status <> 'cancelled'
  ) b on true
  where ds.slot_date between p_from and p_from + (least(greatest(p_days, 1), 14) - 1)
  order by ds.slot_date, ds.start_time;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Gateway RPCs (test mode)
-- ---------------------------------------------------------------------------
create or replace function public.test_payments_enabled()
returns boolean
language sql stable
as $$ select coalesce(current_setting('app.allow_test_payments', true), 'on') <> 'off' $$;

create or replace function public.create_payment_order(p_amount numeric, p_purpose text)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_id text := public.new_gateway_id('order');
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_purpose not in ('wallet_topup', 'order') then
    raise exception 'Invalid payment purpose';
  end if;
  if p_purpose = 'wallet_topup' and public.current_role_of(auth.uid()) <> 'customer' then
    raise exception 'Only customers can top up a wallet';
  end if;
  if p_amount is null or p_amount < 1 or p_amount > 100000 then
    raise exception 'Amount must be between ₹1 and ₹1,00,000';
  end if;

  insert into public.gateway_payments (gateway_order_id, user_id, amount, purpose)
  values (v_id, auth.uid(), round(p_amount, 2), p_purpose);

  return jsonb_build_object('id', v_id, 'amount', round(p_amount, 2), 'currency', 'INR',
                            'purpose', p_purpose, 'status', 'created');
end;
$$;

create or replace function public.capture_test_payment(p_gateway_order_id text, p_method text, p_detail text)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_pay public.gateway_payments;
  v_payment_id text := public.new_gateway_id('pay');
begin
  if not public.test_payments_enabled() then
    raise exception 'Test payments are disabled on this server';
  end if;
  if p_method not in ('upi', 'card', 'netbanking', 'wallet') then
    raise exception 'Unsupported payment method';
  end if;
  -- only display-safe details (UPI id, card network + last 4, bank name)
  if regexp_replace(coalesce(p_detail, ''), '\s', '', 'g') ~ '[0-9]{9,}' then
    raise exception 'Payment details must not include full card or account numbers';
  end if;

  select * into v_pay from public.gateway_payments
  where gateway_order_id = p_gateway_order_id for update;
  if v_pay.gateway_order_id is null or v_pay.user_id <> auth.uid() then
    raise exception 'Payment not found';
  end if;
  if v_pay.status <> 'created' then
    raise exception 'This payment has already been processed';
  end if;

  update public.gateway_payments
  set payment_id = v_payment_id, method = p_method, method_detail = left(p_detail, 80),
      status = 'captured', captured_at = now()
  where gateway_order_id = p_gateway_order_id;

  if v_pay.purpose = 'wallet_topup' then
    perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
    insert into public.wallet_transactions (user_id, amount, transaction_type, status, description)
    values (auth.uid(), v_pay.amount, 'deposit', 'completed',
            format('Wallet top-up · %s (%s)', upper(p_method), v_payment_id));
  end if;

  return jsonb_build_object('id', v_payment_id, 'gateway_order_id', p_gateway_order_id,
                            'amount', v_pay.amount, 'purpose', v_pay.purpose, 'method', p_method,
                            'method_detail', left(p_detail, 80), 'status', 'captured');
end;
$$;

create or replace function public.fail_test_payment(p_gateway_order_id text, p_method text, p_detail text, p_reason text)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_payment_id text := public.new_gateway_id('pay');
begin
  update public.gateway_payments
  set payment_id = v_payment_id, method = p_method, method_detail = left(p_detail, 80),
      status = 'failed', failure_reason = left(p_reason, 160)
  where gateway_order_id = p_gateway_order_id and user_id = auth.uid() and status = 'created';
  if not found then
    raise exception 'Payment not found or already processed';
  end if;
  return jsonb_build_object('id', v_payment_id, 'status', 'failed');
end;
$$;

-- An order that fails after a successful payment rolls back, so the client
-- calls this to return the money (a nightly job can sweep stragglers too).
create or replace function public.refund_unused_payment(p_gateway_order_id text)
returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  update public.gateway_payments
  set status = 'refunded', refunded_at = now()
  where gateway_order_id = p_gateway_order_id
    and (user_id = auth.uid() or public.is_admin())
    and purpose = 'order' and status = 'captured' and order_id is null;
  return found;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. place_order — slots + online payment
-- ---------------------------------------------------------------------------
drop function if exists public.place_order(text, numeric, text, text, double precision, double precision, text);

create or replace function public.place_order(
  p_milk_type text,
  p_quantity numeric,
  p_payment_method text,
  p_address text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_notes text default null,
  p_slot_id uuid default null,
  p_gateway_order_id text default null
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
  v_slot public.delivery_slots;
  v_booked integer;
  v_pay public.gateway_payments;
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

  -- online: a captured, unused payment of this user for exactly this total
  if v_method::text = 'online' then
    select * into v_pay from public.gateway_payments
    where gateway_order_id = p_gateway_order_id for update;
    if v_pay.gateway_order_id is null or v_pay.user_id <> auth.uid() or v_pay.purpose <> 'order' then
      raise exception 'Payment not found — please pay again';
    end if;
    if v_pay.status <> 'captured' then
      raise exception 'Payment was not completed';
    end if;
    if v_pay.order_id is not null then
      raise exception 'This payment has already been used for another order';
    end if;
    if abs(v_pay.amount - v_total) > 0.005 then
      raise exception 'The amount paid doesn''t match the order total.';
    end if;
  end if;

  -- delivery slot: active, before the 30-minute cutoff, within 3 days, not full
  if p_slot_id is not null then
    select * into v_slot from public.delivery_slots where id = p_slot_id for update;
    if v_slot.id is null or not v_slot.is_active then
      raise exception 'That delivery slot isn''t available.';
    end if;
    if public.slot_starts_at(v_slot.slot_date, v_slot.start_time) - interval '30 minutes' <= now() then
      raise exception 'That slot has closed — pick a later window.';
    end if;
    if v_slot.slot_date > (now() at time zone public.app_tz())::date + 3 then
      raise exception 'Slots can be booked up to 3 days ahead.';
    end if;
    select count(*) into v_booked from public.orders
    where delivery_slot_id = p_slot_id and status <> 'cancelled';
    if v_booked >= v_slot.capacity then
      raise exception 'That slot just filled up — pick another window.';
    end if;
  end if;

  select * into v_stock_row from public.milk_stock where date = current_date for update;
  select coalesce(sum(reserved_amount), 0) into v_reserved
  from public.stock_reservations where reservation_date = current_date;
  if v_stock_row.id is null or (v_stock_row.total_stock - v_reserved) < p_quantity then
    raise exception 'Insufficient stock available today.';
  end if;

  if v_method = 'wallet' then
    perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
    select coalesce(sum(case transaction_type when 'deposit' then amount else -amount end), 0)
      into v_balance
    from public.wallet_transactions
    where user_id = auth.uid() and status = 'completed';
    if v_balance < v_total then
      raise exception 'Insufficient wallet balance. Need ₹% more.',
        to_char(v_total - v_balance, 'FM999999990.00');
    end if;
  end if;

  insert into public.orders (
    customer_id, total_amount, status, payment_method,
    delivery_address, delivery_lat, delivery_lng, delivery_notes, source,
    delivery_slot_id, gateway_payment_id
  )
  values (
    auth.uid(), v_total, 'pending', v_method,
    coalesce(nullif(trim(p_address), ''), v_profile.address),
    coalesce(p_lat, v_profile.latitude),
    coalesce(p_lng, v_profile.longitude),
    nullif(trim(p_notes), ''),
    'order',
    p_slot_id,
    v_pay.payment_id
  )
  returning id into v_order_id;

  insert into public.order_items (order_id, product_id, quantity, unit_price)
  values (v_order_id, v_product.id, p_quantity, v_product.price);
  insert into public.order_otps (order_id, otp) values (v_order_id, public.new_delivery_otp());

  if v_method = 'wallet' then
    insert into public.wallet_transactions (user_id, amount, transaction_type, status, description, order_id)
    values (auth.uid(), v_total, 'withdrawal', 'completed', 'Order payment', v_order_id);
  end if;
  if v_pay.gateway_order_id is not null then
    update public.gateway_payments set order_id = v_order_id where gateway_order_id = v_pay.gateway_order_id;
  end if;

  update public.milk_stock
  set total_stock = total_stock - p_quantity, updated_at = now()
  where id = v_stock_row.id;

  return v_order_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. cancel_order — refunds online payments to source (test mode: instant)
-- ---------------------------------------------------------------------------
create or replace function public.cancel_order(p_order_id uuid)
returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders;
  v_qty numeric;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'Order not found';
  end if;
  if v_order.customer_id <> auth.uid() and not public.is_admin() then
    raise exception 'Not allowed';
  end if;
  if v_order.status <> 'pending' then
    raise exception 'Only pending orders can be cancelled';
  end if;

  update public.orders set status = 'cancelled' where id = p_order_id;

  if v_order.payment_method = 'wallet' then
    perform pg_advisory_xact_lock(hashtext(v_order.customer_id::text));
    insert into public.wallet_transactions (user_id, amount, transaction_type, status, description, order_id)
    values (v_order.customer_id, v_order.total_amount, 'deposit', 'completed', 'Refund for cancelled order', p_order_id);
  elsif v_order.payment_method::text = 'online' then
    update public.gateway_payments
    set status = 'refunded', refunded_at = now()
    where payment_id = v_order.gateway_payment_id and status = 'captured';
  end if;

  select coalesce(sum(quantity), 0) into v_qty from public.order_items where order_id = p_order_id;
  update public.milk_stock set total_stock = total_stock + v_qty, updated_at = now() where date = current_date;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Subscription skips / vacation
-- ---------------------------------------------------------------------------
create or replace function public.set_subscription_skips(p_subscription_id uuid, p_dates date[], p_skip boolean)
returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_sub public.subscriptions;
  v_today date := (now() at time zone public.app_tz())::date;
  d date;
begin
  select * into v_sub from public.subscriptions where id = p_subscription_id;
  if v_sub.id is null or (v_sub.customer_id <> auth.uid() and not public.is_admin()) then
    raise exception 'Subscription not found';
  end if;
  if v_sub.status = 'cancelled' then
    raise exception 'Cancelled subscriptions cannot be changed';
  end if;
  if p_skip and cardinality(p_dates) > 60 then
    raise exception 'A vacation can be at most 60 days';
  end if;
  foreach d in array coalesce(p_dates, '{}') loop
    if d <= v_today then
      raise exception 'You can only skip deliveries from tomorrow onwards';
    end if;
    if d > v_today + 90 then
      raise exception 'Skips can be planned up to 90 days ahead';
    end if;
  end loop;

  if p_skip then
    insert into public.subscription_skips (subscription_id, skip_date)
    select p_subscription_id, unnest(p_dates)
    on conflict do nothing;
  else
    delete from public.subscription_skips
    where subscription_id = p_subscription_id and skip_date = any (p_dates);
  end if;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Subscription billing & reservations honour skips and preferred slots
-- ---------------------------------------------------------------------------
create or replace function public.generate_subscription_orders(p_date date default current_date)
returns integer
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  s public.subscriptions;
  v_product public.products;
  v_profile public.profiles;
  v_total numeric;
  v_balance numeric;
  v_order_id uuid;
  v_slot_id uuid;
  v_count integer := 0;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Only admins may generate subscription orders';
  end if;

  perform public.ensure_delivery_slots(p_date, 1);

  for s in select * from public.subscriptions where status = 'active' loop
    continue when not public.subscription_due_on(s, p_date);
    continue when exists (select 1 from public.subscription_skips k where k.subscription_id = s.id and k.skip_date = p_date);
    continue when exists (
      select 1 from public.orders o
      left join public.delivery_slots ds on ds.id = o.delivery_slot_id
      where o.subscription_id = s.id
        and coalesce(ds.slot_date, (o.created_at at time zone public.app_tz())::date) = p_date
    );

    select * into v_product from public.products where id = s.product_id and is_active;
    if v_product.id is null then
      select * into v_product from public.products where milk_type = s.milk_type and is_active order by price limit 1;
    end if;
    continue when v_product.id is null;

    select * into v_profile from public.profiles where id = s.customer_id;
    v_total := round(v_product.price * s.quantity, 2);

    perform pg_advisory_xact_lock(hashtext(s.customer_id::text));
    select coalesce(sum(case transaction_type when 'deposit' then amount else -amount end), 0) into v_balance
    from public.wallet_transactions where user_id = s.customer_id and status = 'completed';
    continue when v_balance < v_total;

    -- preferred window first, then the earliest window with room
    select ds.id into v_slot_id
    from public.delivery_slots ds
    where ds.slot_date = p_date and ds.is_active
      and (select count(*) from public.orders o where o.delivery_slot_id = ds.id and o.status <> 'cancelled') < ds.capacity
    order by (ds.start_time = s.preferred_slot_start) desc nulls last, ds.start_time
    limit 1;

    insert into public.orders (customer_id, total_amount, status, payment_method,
      delivery_address, delivery_lat, delivery_lng, source, subscription_id, delivery_slot_id)
    values (s.customer_id, v_total, 'pending', 'wallet',
      v_profile.address, v_profile.latitude, v_profile.longitude, 'subscription', s.id, v_slot_id)
    returning id into v_order_id;

    insert into public.order_items (order_id, product_id, quantity, unit_price)
    values (v_order_id, v_product.id, s.quantity, v_product.price);
    insert into public.order_otps (order_id, otp) values (v_order_id, public.new_delivery_otp());
    insert into public.wallet_transactions (user_id, amount, transaction_type, status, description, order_id)
    values (s.customer_id, v_total, 'withdrawal', 'completed', 'Subscription delivery', v_order_id);

    update public.milk_stock set total_stock = greatest(0, total_stock - s.quantity), updated_at = now()
    where date = p_date;
    update public.stock_reservations set reserved_amount = greatest(0, reserved_amount - s.quantity)
    where reservation_date = p_date and reservation_type = 'subscription';

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- Reserve exactly what is due tomorrow (frequency-aware, minus skips).
create or replace function public.auto_reserve_subscription_stock()
returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_tomorrow date := (now() at time zone public.app_tz())::date + 1;
  v_demand numeric := 0;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Only admins may manage reservations';
  end if;

  select coalesce(sum(s.quantity), 0) into v_demand
  from public.subscriptions s
  where s.status = 'active'
    and public.subscription_due_on(s, v_tomorrow)
    and not exists (select 1 from public.subscription_skips k where k.subscription_id = s.id and k.skip_date = v_tomorrow);

  insert into public.stock_reservations (reservation_date, reserved_amount, reservation_type)
  values (v_tomorrow, ceiling(v_demand), 'subscription')
  on conflict (reservation_date, reservation_type)
  do update set reserved_amount = excluded.reserved_amount;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Dispatch only orders that are due (express, or slot within 90 minutes)
-- ---------------------------------------------------------------------------
create or replace function public.order_dispatchable(p_slot_id uuid)
returns boolean
language sql stable
set search_path = public, pg_temp
as $$
  select p_slot_id is null or exists (
    select 1 from public.delivery_slots ds
    where ds.id = p_slot_id
      and public.slot_starts_at(ds.slot_date, ds.start_time) <= now() + interval '90 minutes'
  )
$$;

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
      and public.order_dispatchable(delivery_slot_id)
    order by created_at
    for update skip locked
  loop
    select p.id into v_rider
    from public.profiles p
    left join public.rider_locations l on l.rider_id = p.id
    left join lateral (
      select count(*) as active from public.orders o
      where o.delivery_person_id = p.id and o.status in ('pending', 'out_for_delivery')
    ) a on true
    where p.user_type = 'delivery' and p.status = 'approved' and a.active < p_max_per_rider
    order by public.distance_m(coalesce(l.lat, v_depot.lat), coalesce(l.lng, v_depot.lng),
                               v_order.delivery_lat, v_order.delivery_lng) + a.active * 800
    limit 1;

    exit when v_rider is null;
    update public.orders set delivery_person_id = v_rider, assigned_at = now() where id = v_order.id;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. Realtime & grants
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['gateway_payments', 'delivery_slots', 'subscription_skips'] loop
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

revoke execute on function
  public.ensure_delivery_slots(date, integer),
  public.new_gateway_id(text)
from public, anon, authenticated;

revoke execute on function
  public.get_delivery_slots(date, integer),
  public.create_payment_order(numeric, text),
  public.capture_test_payment(text, text, text),
  public.fail_test_payment(text, text, text, text),
  public.refund_unused_payment(text),
  public.place_order(text, numeric, text, text, double precision, double precision, text, uuid, text),
  public.set_subscription_skips(uuid, date[], boolean)
from public, anon;

grant execute on function
  public.get_delivery_slots(date, integer),
  public.create_payment_order(numeric, text),
  public.capture_test_payment(text, text, text),
  public.fail_test_payment(text, text, text, text),
  public.refund_unused_payment(text),
  public.place_order(text, numeric, text, text, double precision, double precision, text, uuid, text),
  public.set_subscription_skips(uuid, date[], boolean),
  public.slot_starts_at(date, time),
  public.order_dispatchable(uuid),
  public.app_tz(),
  public.test_payments_enabled()
to authenticated;

-- Optional (pg_cron): refund order payments that were captured but never used.
-- select cron.schedule('refund-unused-payments', '*/15 * * * *', $$
--   update public.gateway_payments set status = 'refunded', refunded_at = now()
--   where purpose = 'order' and status = 'captured' and order_id is null
--     and captured_at < now() - interval '30 minutes' $$);
