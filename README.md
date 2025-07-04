# MilkyWay Delivery System

A milk supply-chain platform connecting farmers, customers, delivery staff and
administrators. Built with React 18 + TypeScript + Vite, shadcn/ui, and Supabase
(Postgres with Row Level Security).

> **July 2026 — security rebuild.** The original prototype was fully reworked:
> hardcoded credentials removed, role-escalation and wallet-forgery paths closed,
> all money/stock mutations moved into atomic server-side functions, and RLS
> rewritten with least privilege. Details in [Security model](#security-model).

## Setup

### 1. Frontend

```sh
npm install
cp .env.example .env   # then fill in your Supabase URL + anon key
npm run dev
```

Environment variables (never commit `.env`):

| Variable                 | Where to find it                                  |
| ------------------------ | ------------------------------------------------- |
| `VITE_SUPABASE_URL`      | Supabase dashboard → Project Settings → API       |
| `VITE_SUPABASE_ANON_KEY` | Supabase dashboard → Project Settings → API       |

### 2. Database

Apply the single migration to a **fresh** Supabase project (SQL editor or
`supabase db push`):

```
supabase/migrations/20260711000001_secure_rebuild.sql
```

It creates the full schema, RLS policies, atomic RPC functions and seed
products/pricing. Old SQL files were superseded and moved to `legacy_sql/`
(do not apply them — they contain the vulnerabilities this rebuild fixes).

### 3. First admin account

Admin accounts cannot be self-registered. Either:

```sql
-- allow an email to sign up as admin through the app
insert into public.admin_allowlist (email) values ('you@example.com');
```

or promote an existing user:

```sql
update public.profiles set user_type = 'admin' where email = 'you@example.com';
```

### 4. Optional nightly jobs

If your plan has `pg_cron`, uncomment section 11 of the migration to schedule
the daily stock archive/reset and subscription reservations.

## Scripts

| Command             | Purpose                        |
| ------------------- | ------------------------------ |
| `npm run dev`       | Dev server on port 8080        |
| `npm run build`     | Production build               |
| `npm run typecheck` | TypeScript check               |
| `npm run lint`      | ESLint                         |

## Security model

- **Roles** (`admin`, `farmer`, `customer`, `delivery`) live in
  `profiles.user_type` and are never writable by clients. The signup trigger
  validates the requested role, rejects non-allowlisted admin signups, and a
  guard trigger blocks role/status changes by non-admins.
- **Wallets** cannot be written by clients at all. Balances are computed
  server-side (`get_wallet_balance`); deposits/withdrawals happen only inside
  SECURITY DEFINER RPCs serialized per user with advisory locks.
- **Orders** are created via `place_order`, which looks up the price, verifies
  stock, debits the wallet and writes the order + items in one transaction.
  Cancellation (`cancel_order`) refunds and restores stock atomically.
- **Farmer payments**: farmers request payment (`request_farmer_payment`);
  the amount is computed server-side from `milk_pricing`. Admin review
  (`review_farmer_payment`) atomically approves + credits the farmer's wallet,
  or rejects + releases the contributions.
- **Milk collections** (`submit_milk_collection`, staff-only) enforce the
  quality gate: substandard milk is logged but not stocked, and three
  consecutive substandard submissions blacklist the farmer.
- **RLS** is least-privilege per table; privileged mutations are revoked from
  clients and exposed only through role-checked RPCs (`search_path` pinned).
- **Routing**: every dashboard is wrapped in `ProtectedRoute`, which blocks
  rendering (and data fetching) until the session and role are verified.

> The wallet recharge flow is a demo. In production, credit wallets only from a
> payment-gateway webhook using the service role — never from the client.

## Project structure

```
src/
  contexts/AuthContext.tsx        session + profile state (onAuthStateChange)
  components/auth/ProtectedRoute  role-based route guard
  lib/rpc.ts                      typed wrappers for all server RPCs
  integrations/supabase/          env-based client + schema types
  pages/dashboard/                one dashboard per role
supabase/migrations/              the single authoritative migration
legacy_sql/                       superseded SQL kept for reference only
```
