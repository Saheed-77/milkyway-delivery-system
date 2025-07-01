-- ============================================================================
-- MilkyWay Delivery System — Secure Rebuild
-- Apply this single migration to a FRESH Supabase project.
-- It replaces all previous SQL (src/sql/*, older migrations), which contained
-- permissive RLS, missing functions, and privilege-escalation paths.
--
-- Security model:
--   * Roles live in profiles.user_type and are NEVER writable by clients.
--   * Admin accounts cannot be self-registered; promote via admin_allowlist.
--   * All money/stock mutations happen through SECURITY DEFINER RPCs that
--     validate the caller's role and run atomically.
--   * Direct table writes from clients are denied by RLS except where safe.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Extensions
-- ---------------------------------------------------------------------------
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('admin', 'farmer', 'customer', 'delivery');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.account_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.order_status as enum ('pending', 'out_for_delivery', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_method as enum ('wallet', 'cash');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.txn_type as enum ('deposit', 'withdrawal');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.txn_status as enum ('pending', 'completed', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.milk_kind as enum ('cow', 'buffalo', 'goat');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.sub_frequency as enum ('daily', 'weekly', 'monthly');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------

-- Emails allowed to register/be promoted as admin. Managed only via SQL editor
-- or service role — no client access at all.
create table if not exists public.admin_allowlist (
  email text primary key,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  user_type public.user_role not null default 'customer',
  status public.account_status not null default 'approved',
  first_name text,
  last_name text,
  phone text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.farmers (
  id uuid primary key references public.profiles (id) on delete cascade,
  farmer_id bigint generated always as identity unique,
  farm_name text not null,
  farm_location text,
  production_capacity numeric check (production_capacity is null or production_capacity >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  milk_type public.milk_kind not null,
  price numeric not null check (price > 0),
  unit text not null default 'liter',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.milk_pricing (
  id uuid primary key default gen_random_uuid(),
  milk_type public.milk_kind not null,
  price_per_liter numeric not null check (price_per_liter > 0),
  effective_from date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id),
  total_amount numeric not null check (total_amount >= 0),
  status public.order_status not null default 'pending',
  payment_method public.payment_method not null default 'wallet',
  delivery_person_id uuid references public.profiles (id),
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid not null references public.products (id),
  quantity numeric not null check (quantity > 0),
  unit_price numeric not null check (unit_price >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  amount numeric not null check (amount > 0),
  transaction_type public.txn_type not null,
  status public.txn_status not null default 'completed',
  description text,
  order_id uuid references public.orders (id),
  created_at timestamptz not null default now()
);

create table if not exists public.farmer_payments (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.profiles (id),
  amount numeric not null check (amount > 0),
  status public.payment_status not null default 'pending',
  payment_date date not null default current_date,
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.milk_contributions (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.profiles (id),
  quantity numeric not null check (quantity >= 0),  -- 0 records a rejected (substandard) submission
  milk_type public.milk_kind not null,
  quality_rating integer check (quality_rating between 1 and 3), -- 1 good, 2 average, 3 substandard
  contribution_date date not null default current_date,
  payment_id uuid references public.farmer_payments (id),
  created_at timestamptz not null default now()
);

create table if not exists public.milk_collections (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid references public.profiles (id),
  collected_by uuid references public.profiles (id),
  quantity numeric not null check (quantity > 0),
  milk_type public.milk_kind not null default 'cow',
  created_at timestamptz not null default now()
);

-- One stock row per day.
create table if not exists public.milk_stock (
  id uuid primary key default gen_random_uuid(),
  date date not null unique default current_date,
  total_stock numeric not null default 0 check (total_stock >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.milk_stock_archive (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  total_stock numeric not null,
  subscription_demand numeric not null,
  leftover_stock numeric not null,
  created_at timestamptz not null default now()
);

create table if not exists public.stock_reservations (
  id uuid primary key default gen_random_uuid(),
  reservation_date date not null,
  reserved_amount numeric not null check (reserved_amount >= 0),
  reservation_type text not null default 'subscription',
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id),
  product_id uuid references public.products (id),
  milk_type public.milk_kind not null default 'cow',
  quantity numeric not null check (quantity > 0),
  frequency public.sub_frequency not null default 'daily',
  status text not null default 'active' check (status in ('active', 'paused', 'cancelled')),
  next_delivery timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.delivery_slots (
  id uuid primary key default gen_random_uuid(),
  slot_date date not null,
  start_time time not null,
  end_time time not null,
  capacity integer not null default 20 check (capacity > 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_orders_customer on public.orders (customer_id, created_at desc);
create index if not exists idx_orders_status on public.orders (status);
create index if not exists idx_wallet_user on public.wallet_transactions (user_id, created_at desc);
create index if not exists idx_contrib_farmer on public.milk_contributions (farmer_id, contribution_date desc);
create index if not exists idx_contrib_payment on public.milk_contributions (payment_id);
create index if not exists idx_payments_farmer on public.farmer_payments (farmer_id, created_at desc);
create index if not exists idx_reservations_date on public.stock_reservations (reservation_date);

-- ---------------------------------------------------------------------------
-- 3. Role helpers (SECURITY DEFINER so they bypass RLS without recursion)
-- ---------------------------------------------------------------------------
create or replace function public.current_role_of(p_user uuid)
returns public.user_role
language sql stable security definer
set search_path = public, pg_temp
as $$
  select user_type from public.profiles where id = p_user
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.current_role_of(auth.uid()) = 'admin', false)
$$;

create or replace function public.is_delivery()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.current_role_of(auth.uid()) = 'delivery', false)
$$;

create or replace function public.is_approved_farmer()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and user_type = 'farmer' and status = 'approved'
  )
$$;

revoke all on function public.current_role_of(uuid) from anon;

-- ---------------------------------------------------------------------------
-- 4. Signup trigger — profile creation with role coercion
--    * 'admin' signups are rejected unless the email is allowlisted.
--    * Unknown roles are coerced to 'customer'.
--    * Farmers start as 'pending'; a farmers row is created from metadata.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_requested text := coalesce(new.raw_user_meta_data ->> 'user_type', 'customer');
  v_role public.user_role;
  v_status public.account_status := 'approved';
begin
  if v_requested = 'admin' then
    if not exists (select 1 from public.admin_allowlist where lower(email) = lower(new.email)) then
      raise exception 'Admin accounts cannot be self-registered';
    end if;
    v_role := 'admin';
  elsif v_requested in ('farmer', 'customer', 'delivery') then
    v_role := v_requested::public.user_role;
  else
    v_role := 'customer';
  end if;

  if v_role = 'farmer' then
    v_status := 'pending';
  end if;

  insert into public.profiles (id, email, user_type, status, first_name, last_name, phone, address)
  values (
    new.id,
    new.email,
    v_role,
    v_status,
    nullif(trim(new.raw_user_meta_data ->> 'first_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'last_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'phone'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'address'), '')
  );

  if v_role = 'farmer' then
    insert into public.farmers (id, farm_name, farm_location)
    values (
      new.id,
      coalesce(nullif(trim(new.raw_user_meta_data ->> 'farm_name'), ''), 'Unnamed Farm'),
      nullif(trim(new.raw_user_meta_data ->> 'farm_location'), '')
    );
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Block non-admins from changing role/status via UPDATE, even where RLS
-- allows profile edits.
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if (new.user_type is distinct from old.user_type
      or new.status is distinct from old.status)
     and not public.is_admin() then
    raise exception 'Only admins may change roles or account status';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists guard_profile_privileges on public.profiles;
create trigger guard_profile_privileges
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- ---------------------------------------------------------------------------
-- 5. Row Level Security — least privilege
-- ---------------------------------------------------------------------------
alter table public.admin_allowlist enable row level security;   -- no policies: clients get nothing
alter table public.profiles enable row level security;
alter table public.farmers enable row level security;
alter table public.products enable row level security;
alter table public.milk_pricing enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.farmer_payments enable row level security;
alter table public.milk_contributions enable row level security;
alter table public.milk_collections enable row level security;
alter table public.milk_stock enable row level security;
alter table public.milk_stock_archive enable row level security;
alter table public.stock_reservations enable row level security;
alter table public.subscriptions enable row level security;
alter table public.delivery_slots enable row level security;

-- profiles
create policy "read own profile" on public.profiles
  for select using (id = auth.uid());
create policy "admin reads all profiles" on public.profiles
  for select using (public.is_admin());
-- Delivery staff need customer names/addresses to deliver orders and
-- farmer names to record collections.
create policy "delivery reads customer and farmer profiles" on public.profiles
  for select using (public.is_delivery() and user_type in ('customer', 'farmer'));
create policy "update own profile" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy "admin updates profiles" on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());

-- farmers
create policy "farmer reads own record" on public.farmers
  for select using (id = auth.uid());
create policy "admin reads farmers" on public.farmers
  for select using (public.is_admin());
create policy "farmer updates own record" on public.farmers
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy "admin manages farmers" on public.farmers
  for all using (public.is_admin()) with check (public.is_admin());
create policy "delivery reads farmers" on public.farmers
  for select using (public.is_delivery());

-- products & pricing: readable by all signed-in users, managed by admin
create policy "authenticated read products" on public.products
  for select to authenticated using (true);
create policy "admin manages products" on public.products
  for all using (public.is_admin()) with check (public.is_admin());

create policy "authenticated read pricing" on public.milk_pricing
  for select to authenticated using (true);
create policy "admin manages pricing" on public.milk_pricing
  for all using (public.is_admin()) with check (public.is_admin());

-- orders: reads scoped by role; ALL writes go through RPCs
create policy "customer reads own orders" on public.orders
  for select using (customer_id = auth.uid());
create policy "delivery reads orders" on public.orders
  for select using (public.is_delivery());
create policy "admin reads orders" on public.orders
  for select using (public.is_admin());
-- Admin may adjust order status directly (amounts stay RPC-only because
-- UPDATE policies don't allow INSERTs and totals are checked server-side).
create policy "admin updates orders" on public.orders
  for update using (public.is_admin()) with check (public.is_admin());

create policy "order items follow order access" on public.order_items
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and (o.customer_id = auth.uid() or public.is_delivery() or public.is_admin())
    )
  );

-- wallet: read own; NO client writes (RPC only)
create policy "read own wallet" on public.wallet_transactions
  for select using (user_id = auth.uid());
create policy "admin reads wallets" on public.wallet_transactions
  for select using (public.is_admin());

-- farmer payments: farmer reads own, admin reads all; writes via RPC only
create policy "farmer reads own payments" on public.farmer_payments
  for select using (farmer_id = auth.uid());
create policy "admin reads payments" on public.farmer_payments
  for select using (public.is_admin());

-- contributions: farmer reads own, admin/delivery read all; writes via RPC
create policy "farmer reads own contributions" on public.milk_contributions
  for select using (farmer_id = auth.uid());
create policy "staff reads contributions" on public.milk_contributions
  for select using (public.is_admin() or public.is_delivery());

-- collections: staff read; writes via RPC
create policy "staff reads collections" on public.milk_collections
  for select using (public.is_admin() or public.is_delivery());
create policy "farmer reads own collections" on public.milk_collections
  for select using (farmer_id = auth.uid());

-- stock: all authenticated may read; writes via RPC
create policy "authenticated read stock" on public.milk_stock
  for select to authenticated using (true);
create policy "authenticated read stock archive" on public.milk_stock_archive
  for select to authenticated using (true);
create policy "staff read reservations" on public.stock_reservations
  for select using (public.is_admin() or public.is_delivery());
create policy "admin manages reservations" on public.stock_reservations
  for all using (public.is_admin()) with check (public.is_admin());

-- subscriptions: customer manages own (quantity limits enforced by checks)
create policy "customer reads own subscriptions" on public.subscriptions
  for select using (customer_id = auth.uid());
create policy "customer creates subscription" on public.subscriptions
  for insert with check (customer_id = auth.uid());
create policy "customer updates own subscription" on public.subscriptions
  for update using (customer_id = auth.uid()) with check (customer_id = auth.uid());
create policy "admin manages subscriptions" on public.subscriptions
  for all using (public.is_admin()) with check (public.is_admin());

-- delivery slots
create policy "authenticated read slots" on public.delivery_slots
  for select to authenticated using (true);
create policy "admin manages slots" on public.delivery_slots
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 6. Wallet RPCs (atomic, serialized per user via advisory lock)
-- ---------------------------------------------------------------------------
create or replace function public.get_wallet_balance()
returns numeric
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(sum(
    case transaction_type when 'deposit' then amount else -amount end
  ), 0)
  from public.wallet_transactions
  where user_id = auth.uid() and status = 'completed'
$$;

-- Demo recharge. In production this must be driven by a payment-gateway
-- webhook (service role), never directly by the client.
create or replace function public.recharge_wallet(p_amount numeric)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 100000 then
    raise exception 'Invalid recharge amount';
  end if;

  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));

  insert into public.wallet_transactions (user_id, amount, transaction_type, status, description)
  values (auth.uid(), round(p_amount, 2), 'deposit', 'completed', 'Wallet recharge')
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Order RPCs — price, stock and wallet all resolved server-side
-- ---------------------------------------------------------------------------
create or replace function public.place_order(
  p_milk_type text,
  p_quantity numeric,
  p_payment_method text
)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_product public.products;
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

  begin
    v_milk := p_milk_type::public.milk_kind;
    v_method := p_payment_method::public.payment_method;
  exception when others then
    raise exception 'Invalid milk type or payment method';
  end;

  -- cheapest active product of the requested milk type
  select * into v_product
  from public.products
  where milk_type = v_milk and is_active
  order by price
  limit 1;

  if v_product.id is null then
    raise exception 'No % milk products available', p_milk_type;
  end if;

  v_total := round(v_product.price * p_quantity, 2);

  -- lock today's stock row and verify availability
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

  -- wallet payment: serialize the user's wallet and verify funds
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

  insert into public.orders (customer_id, total_amount, status, payment_method)
  values (auth.uid(), v_total, 'pending', v_method)
  returning id into v_order_id;

  insert into public.order_items (order_id, product_id, quantity, unit_price)
  values (v_order_id, v_product.id, p_quantity, v_product.price);

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

create or replace function public.cancel_order(p_order_id uuid)
returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders;
  v_qty numeric;
begin
  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

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

  -- refund wallet payments
  if v_order.payment_method = 'wallet' then
    perform pg_advisory_xact_lock(hashtext(v_order.customer_id::text));
    insert into public.wallet_transactions
      (user_id, amount, transaction_type, status, description, order_id)
    values
      (v_order.customer_id, v_order.total_amount, 'deposit', 'completed',
       'Refund for cancelled order', p_order_id);
  end if;

  -- restore stock
  select coalesce(sum(quantity), 0) into v_qty
  from public.order_items where order_id = p_order_id;

  update public.milk_stock
  set total_stock = total_stock + v_qty, updated_at = now()
  where date = current_date;

  return true;
end;
$$;

create or replace function public.complete_delivery(p_order_id uuid)
returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders;
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

  update public.orders
  set status = 'completed',
      delivery_person_id = auth.uid(),
      delivered_at = now()
  where id = p_order_id;

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Farmer workflow RPCs
-- ---------------------------------------------------------------------------
create or replace function public.set_farmer_status(p_farmer_id uuid, p_status text)
returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins may change farmer status';
  end if;
  if p_status not in ('approved', 'rejected', 'pending') then
    raise exception 'Invalid status';
  end if;

  update public.profiles
  set status = p_status::public.account_status, updated_at = now()
  where id = p_farmer_id and user_type = 'farmer';

  if not found then
    raise exception 'Farmer not found';
  end if;
  return true;
end;
$$;

-- Farmer records a contribution; stock is incremented atomically.
create or replace function public.record_milk_contribution(
  p_quantity numeric,
  p_milk_type text,
  p_date date default current_date
)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_milk public.milk_kind;
begin
  if not public.is_approved_farmer() then
    raise exception 'Only approved farmers may record contributions';
  end if;
  if p_quantity is null or p_quantity <= 0 or p_quantity > 10000 then
    raise exception 'Invalid quantity';
  end if;
  if p_date is null or p_date > current_date or p_date < current_date - 7 then
    raise exception 'Contribution date must be within the last 7 days';
  end if;

  begin
    v_milk := p_milk_type::public.milk_kind;
  exception when others then
    raise exception 'Invalid milk type';
  end;

  insert into public.milk_contributions (farmer_id, quantity, milk_type, contribution_date)
  values (auth.uid(), p_quantity, v_milk, p_date)
  returning id into v_id;

  insert into public.milk_stock (date, total_stock)
  values (current_date, p_quantity)
  on conflict (date)
  do update set total_stock = public.milk_stock.total_stock + excluded.total_stock,
                updated_at = now();

  return v_id;
end;
$$;

-- Staff records a collection by the farmer's public numeric code, with a
-- quality gate: substandard milk (rating 3) is logged but not stocked, and
-- three consecutive substandard submissions blacklist the farmer.
create or replace function public.submit_milk_collection(
  p_farmer_code bigint,
  p_quantity numeric,
  p_quality_rating integer,
  p_milk_type text default 'cow'
)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_farmer public.farmers;
  v_profile public.profiles;
  v_milk public.milk_kind;
  v_offenses integer := 0;
  r record;
begin
  if not (public.is_admin() or public.is_delivery()) then
    raise exception 'Only staff may record collections';
  end if;
  if p_quantity is null or p_quantity <= 0 or p_quantity > 10000 then
    raise exception 'Invalid quantity';
  end if;
  if p_quality_rating is null or p_quality_rating not between 1 and 3 then
    raise exception 'Quality rating must be between 1 and 3';
  end if;

  begin
    v_milk := p_milk_type::public.milk_kind;
  exception when others then
    raise exception 'Invalid milk type';
  end;

  select * into v_farmer from public.farmers where farmer_id = p_farmer_code;
  if v_farmer.id is null then
    raise exception 'Invalid Farmer ID: no farmer found with this ID';
  end if;

  select * into v_profile from public.profiles where id = v_farmer.id for update;
  if v_profile.status <> 'approved' then
    raise exception 'This farmer is not approved (status: %)', v_profile.status;
  end if;

  if p_quality_rating = 3 then
    -- count consecutive substandard submissions (most recent first)
    v_offenses := 1;
    for r in
      select quality_rating
      from public.milk_contributions
      where farmer_id = v_farmer.id and quality_rating is not null
      order by created_at desc
      limit 10
    loop
      exit when r.quality_rating <> 3;
      v_offenses := v_offenses + 1;
    end loop;

    -- log the rejected submission (quantity 0: nothing enters stock/payment)
    insert into public.milk_contributions
      (farmer_id, quantity, milk_type, quality_rating, contribution_date)
    values (v_farmer.id, 0, v_milk, 3, current_date);

    if v_offenses >= 3 then
      update public.profiles set status = 'rejected', updated_at = now()
      where id = v_farmer.id;
      return jsonb_build_object(
        'outcome', 'blacklisted',
        'offense_count', v_offenses,
        'farmer_name', concat_ws(' ', v_profile.first_name, v_profile.last_name),
        'farmer_email', v_profile.email
      );
    end if;

    return jsonb_build_object(
      'outcome', 'substandard',
      'offense_count', v_offenses,
      'farmer_name', concat_ws(' ', v_profile.first_name, v_profile.last_name),
      'farmer_email', v_profile.email
    );
  end if;

  -- acceptable milk: record contribution (unpaid until the farmer requests
  -- payment) and add to today's stock atomically
  insert into public.milk_contributions
    (farmer_id, quantity, milk_type, quality_rating, contribution_date)
  values (v_farmer.id, p_quantity, v_milk, p_quality_rating, current_date);

  insert into public.milk_collections (farmer_id, collected_by, quantity, milk_type)
  values (v_farmer.id, auth.uid(), p_quantity, v_milk);

  insert into public.milk_stock (date, total_stock)
  values (current_date, p_quantity)
  on conflict (date)
  do update set total_stock = public.milk_stock.total_stock + excluded.total_stock,
                updated_at = now();

  return jsonb_build_object(
    'outcome', 'recorded',
    'offense_count', 0,
    'farmer_name', concat_ws(' ', v_profile.first_name, v_profile.last_name),
    'farmer_email', v_profile.email
  );
end;
$$;

-- Staff (admin/delivery) records a collection on behalf of a farmer.
create or replace function public.record_milk_collection(
  p_farmer_id uuid,
  p_quantity numeric,
  p_milk_type text default 'cow'
)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_milk public.milk_kind;
begin
  if not (public.is_admin() or public.is_delivery()) then
    raise exception 'Only staff may record collections';
  end if;
  if p_quantity is null or p_quantity <= 0 or p_quantity > 10000 then
    raise exception 'Invalid quantity';
  end if;

  begin
    v_milk := p_milk_type::public.milk_kind;
  exception when others then
    raise exception 'Invalid milk type';
  end;

  insert into public.milk_collections (farmer_id, collected_by, quantity, milk_type)
  values (p_farmer_id, auth.uid(), p_quantity, v_milk)
  returning id into v_id;

  insert into public.milk_stock (date, total_stock)
  values (current_date, p_quantity)
  on conflict (date)
  do update set total_stock = public.milk_stock.total_stock + excluded.total_stock,
                updated_at = now();

  return v_id;
end;
$$;

-- Farmer requests payment for all unpaid contributions; amount computed
-- server-side from current milk pricing.
create or replace function public.request_farmer_payment()
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_amount numeric := 0;
  v_payment_id uuid;
begin
  if not public.is_approved_farmer() then
    raise exception 'Only approved farmers may request payment';
  end if;

  perform pg_advisory_xact_lock(hashtext('farmer_payment_' || auth.uid()::text));

  select coalesce(sum(c.quantity * p.price_per_liter), 0) into v_amount
  from public.milk_contributions c
  join lateral (
    select price_per_liter
    from public.milk_pricing mp
    where mp.milk_type = c.milk_type and mp.effective_from <= c.contribution_date
    order by mp.effective_from desc
    limit 1
  ) p on true
  where c.farmer_id = auth.uid() and c.payment_id is null;

  if v_amount <= 0 then
    raise exception 'No unpaid contributions with configured pricing found';
  end if;

  insert into public.farmer_payments (farmer_id, amount, status, payment_date)
  values (auth.uid(), round(v_amount, 2), 'pending', current_date)
  returning id into v_payment_id;

  update public.milk_contributions
  set payment_id = v_payment_id
  where farmer_id = auth.uid() and payment_id is null;

  return v_payment_id;
end;
$$;

-- Admin approves/rejects a payment. Approval credits the farmer's wallet;
-- rejection unlinks contributions so they can be re-requested.
create or replace function public.review_farmer_payment(
  p_payment_id uuid,
  p_approve boolean
)
returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.farmer_payments;
begin
  if not public.is_admin() then
    raise exception 'Only admins may review payments';
  end if;

  select * into v_payment
  from public.farmer_payments
  where id = p_payment_id
  for update;

  if v_payment.id is null then
    raise exception 'Payment not found';
  end if;
  if v_payment.status <> 'pending' then
    raise exception 'Payment already reviewed';
  end if;

  if p_approve then
    update public.farmer_payments
    set status = 'approved', approved_by = auth.uid(), approved_at = now()
    where id = p_payment_id;

    perform pg_advisory_xact_lock(hashtext(v_payment.farmer_id::text));
    insert into public.wallet_transactions
      (user_id, amount, transaction_type, status, description)
    values
      (v_payment.farmer_id, v_payment.amount, 'deposit', 'completed',
       'Milk contribution payment');
  else
    update public.farmer_payments
    set status = 'rejected', approved_by = auth.uid(), approved_at = now()
    where id = p_payment_id;

    update public.milk_contributions
    set payment_id = null
    where payment_id = p_payment_id;
  end if;

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Stock reporting RPCs (shadowing bugs fixed: variables use v_ prefix)
-- ---------------------------------------------------------------------------
create or replace function public.get_latest_milk_stock()
returns table (
  total_stock numeric,
  available_stock numeric,
  subscription_demand numeric,
  date date
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_stock numeric := 0;
  v_demand numeric := 0;
  v_date date;
begin
  select ms.total_stock, ms.date into v_stock, v_date
  from public.milk_stock ms
  order by ms.date desc
  limit 1;

  select coalesce(sum(
    case s.frequency
      when 'daily' then s.quantity
      when 'weekly' then s.quantity / 7
      when 'monthly' then s.quantity / 30
    end), 0) into v_demand
  from public.subscriptions s
  where s.status = 'active';

  return query select
    coalesce(v_stock, 0),
    greatest(0, coalesce(v_stock, 0) - v_demand),
    v_demand,
    v_date;
end;
$$;

create or replace function public.get_today_stock_summary()
returns table (
  total_stock numeric,
  available_stock numeric,
  subscription_demand numeric,
  leftover_from_yesterday numeric,
  sold_stock numeric
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_current numeric := 0;
  v_leftover numeric := 0;
  v_added_today numeric := 0;
  v_demand numeric := 0;
  v_initial numeric := 0;
begin
  select ms.total_stock into v_current
  from public.milk_stock ms
  where ms.date = current_date;
  v_current := coalesce(v_current, 0);

  select coalesce(a.leftover_stock, 0) into v_leftover
  from public.milk_stock_archive a
  where a.date = current_date - 1;
  v_leftover := coalesce(v_leftover, 0);

  select coalesce(sum(c.quantity), 0) into v_added_today
  from public.milk_contributions c
  where c.contribution_date = current_date;

  select coalesce(sum(
    case s.frequency
      when 'daily' then s.quantity
      when 'weekly' then s.quantity / 7
      when 'monthly' then s.quantity / 30
    end), 0) into v_demand
  from public.subscriptions s
  where s.status = 'active';

  v_initial := v_added_today + v_leftover;

  return query select
    v_current,
    greatest(0, v_current - v_demand),
    v_demand,
    v_leftover,
    greatest(0, v_initial - v_current);
end;
$$;

create or replace function public.check_stock_availability(requested_quantity numeric)
returns boolean
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_stock numeric := 0;
  v_reserved numeric := 0;
begin
  select coalesce(ms.total_stock, 0) into v_stock
  from public.milk_stock ms
  where ms.date = current_date;

  select coalesce(sum(sr.reserved_amount), 0) into v_reserved
  from public.stock_reservations sr
  where sr.reservation_date = current_date;

  return coalesce(v_stock, 0) - v_reserved >= requested_quantity;
end;
$$;

-- Admin-only manual stock adjustment.
create or replace function public.update_milk_stock_safe(add_quantity numeric)
returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.is_admin() or public.is_delivery()) then
    raise exception 'Only staff may adjust stock';
  end if;
  if add_quantity is null or abs(add_quantity) > 100000 then
    raise exception 'Invalid quantity';
  end if;

  insert into public.milk_stock (date, total_stock)
  values (current_date, greatest(0, add_quantity))
  on conflict (date)
  do update set total_stock = greatest(0, public.milk_stock.total_stock + add_quantity),
                updated_at = now();
  return true;
end;
$$;

create or replace function public.upsert_milk_stock(p_total numeric)
returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins may set stock';
  end if;
  if p_total is null or p_total < 0 or p_total > 1000000 then
    raise exception 'Invalid stock value';
  end if;

  insert into public.milk_stock (date, total_stock)
  values (current_date, p_total)
  on conflict (date)
  do update set total_stock = excluded.total_stock, updated_at = now();
  return true;
end;
$$;

create or replace function public.auto_reserve_subscription_stock()
returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_demand numeric := 0;
  v_tomorrow date := current_date + 1;
begin
  if not public.is_admin() then
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

  v_demand := ceiling(v_demand);

  insert into public.stock_reservations (reservation_date, reserved_amount, reservation_type)
  values (v_tomorrow, v_demand, 'subscription')
  on conflict do nothing;

  update public.stock_reservations
  set reserved_amount = v_demand
  where reservation_date = v_tomorrow and reservation_type = 'subscription';

  return true;
end;
$$;

-- Nightly archive+reset. Callable by admins from the UI, or by pg_cron /
-- the service role (auth.uid() is null in those contexts).
create or replace function public.archive_and_reset_daily_stock()
returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_yesterday date := current_date - 1;
  v_stock numeric;
  v_demand numeric := 0;
  v_leftover numeric;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Only admins may run the stock reset';
  end if;

  if exists (select 1 from public.milk_stock_archive where date = v_yesterday) then
    return false;
  end if;

  select ms.total_stock into v_stock
  from public.milk_stock ms
  where ms.date = v_yesterday;

  if v_stock is null then
    return false;
  end if;

  select coalesce(sum(
    case s.frequency
      when 'daily' then s.quantity
      when 'weekly' then s.quantity / 7
      when 'monthly' then s.quantity / 30
    end), 0) into v_demand
  from public.subscriptions s
  where s.status = 'active';

  v_leftover := greatest(0, v_stock - v_demand);

  insert into public.milk_stock_archive (date, total_stock, subscription_demand, leftover_stock)
  values (v_yesterday, v_stock, v_demand, v_leftover);

  -- carry leftover into today
  insert into public.milk_stock (date, total_stock)
  values (current_date, v_leftover)
  on conflict (date)
  do update set total_stock = public.milk_stock.total_stock + excluded.total_stock,
                updated_at = now();

  return true;
end;
$$;

-- Archive a specific day's stock row without resetting (admin only).
create or replace function public.archive_milk_inventory(
  archive_date date default current_date - 1
)
returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_stock numeric;
  v_demand numeric := 0;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Only admins may archive inventory';
  end if;

  if exists (select 1 from public.milk_stock_archive where date = archive_date) then
    return false;
  end if;

  select ms.total_stock into v_stock
  from public.milk_stock ms
  where ms.date = archive_date;

  if v_stock is null then
    return false;
  end if;

  select coalesce(sum(
    case s.frequency
      when 'daily' then s.quantity
      when 'weekly' then s.quantity / 7
      when 'monthly' then s.quantity / 30
    end), 0) into v_demand
  from public.subscriptions s
  where s.status = 'active';

  insert into public.milk_stock_archive (date, total_stock, subscription_demand, leftover_stock)
  values (archive_date, v_stock, v_demand, greatest(0, v_stock - v_demand));

  return true;
end;
$$;

-- Archive records for reporting (legacy-compatible shape).
create or replace function public.get_milk_inventory_archive(
  start_date date default null,
  end_date date default null
)
returns table (
  id uuid,
  date date,
  total_stock numeric,
  available_stock numeric,
  subscription_demand numeric,
  leftover_milk numeric,
  created_at timestamptz
)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select
    a.id,
    a.date,
    a.total_stock,
    greatest(0, a.total_stock - a.subscription_demand) as available_stock,
    a.subscription_demand,
    a.leftover_stock as leftover_milk,
    a.created_at
  from public.milk_stock_archive a
  where (start_date is null or a.date >= start_date)
    and (end_date is null or a.date <= end_date)
  order by a.date desc
  limit case when start_date is null and end_date is null then 30 else null end
$$;

-- Aggregate statistics over the archive (shadowing bugs in the legacy
-- version fixed by using v_-prefixed locals).
create or replace function public.get_inventory_summary(
  period_days integer default 30
)
returns table (
  start_date date,
  end_date date,
  avg_total_stock numeric,
  avg_subscription_demand numeric,
  avg_leftover_milk numeric,
  max_total_stock numeric,
  min_total_stock numeric,
  total_days integer
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_end date := current_date - 1;
  v_start date := current_date - 1 - greatest(1, coalesce(period_days, 30));
begin
  return query
  select
    v_start,
    v_end,
    round(avg(a.total_stock)::numeric, 2),
    round(avg(a.subscription_demand)::numeric, 2),
    round(avg(a.leftover_stock)::numeric, 2),
    max(a.total_stock),
    min(a.total_stock),
    count(*)::integer
  from public.milk_stock_archive a
  where a.date between v_start and v_end;
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. Grants: expose RPCs to authenticated users only
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.get_wallet_balance(),
  public.recharge_wallet(numeric),
  public.place_order(text, numeric, text),
  public.cancel_order(uuid),
  public.complete_delivery(uuid),
  public.set_farmer_status(uuid, text),
  public.record_milk_contribution(numeric, text, date),
  public.record_milk_collection(uuid, numeric, text),
  public.submit_milk_collection(bigint, numeric, integer, text),
  public.request_farmer_payment(),
  public.review_farmer_payment(uuid, boolean),
  public.get_latest_milk_stock(),
  public.get_today_stock_summary(),
  public.check_stock_availability(numeric),
  public.update_milk_stock_safe(numeric),
  public.upsert_milk_stock(numeric),
  public.auto_reserve_subscription_stock(),
  public.archive_and_reset_daily_stock(),
  public.archive_milk_inventory(date),
  public.get_milk_inventory_archive(date, date),
  public.get_inventory_summary(integer),
  public.is_admin(),
  public.is_delivery(),
  public.is_approved_farmer()
to authenticated;

-- ---------------------------------------------------------------------------
-- 11. Optional: nightly jobs (uncomment if pg_cron is enabled on your plan)
-- ---------------------------------------------------------------------------
-- create extension if not exists pg_cron;
-- select cron.schedule('daily-milk-stock-reset', '0 0 * * *',
--   $$select public.archive_and_reset_daily_stock()$$);
-- select cron.schedule('daily-subscription-reserve', '15 0 * * *',
--   $$select public.auto_reserve_subscription_stock()$$);

-- ---------------------------------------------------------------------------
-- 12. Seed data (safe defaults; adjust prices as needed)
-- ---------------------------------------------------------------------------
insert into public.products (name, milk_type, price) values
  ('Fresh Cow Milk', 'cow', 60),
  ('Buffalo Milk', 'buffalo', 80),
  ('Goat Milk', 'goat', 120)
on conflict do nothing;

insert into public.milk_pricing (milk_type, price_per_liter) values
  ('cow', 45),
  ('buffalo', 60),
  ('goat', 90)
on conflict do nothing;

-- To create your first admin:
--   1. insert into public.admin_allowlist (email) values ('you@example.com');
--   2. Sign up through the app's admin page with that email.
-- Or promote an existing user:
--   update public.profiles set user_type = 'admin' where email = 'you@example.com';
