# MilkyWay Delivery System

A farm-to-doorstep milk platform connecting **farmers**, **customers**, **delivery riders** and **administrators** — with live map tracking, optimised rider routes and OTP proof of delivery.

Built with React 18 · TypeScript · Vite 7 · Tailwind + shadcn/ui · TanStack Query · Leaflet/OpenStreetMap · Supabase (Postgres + RLS).

> **Try it without a backend.** With no Supabase keys configured the app runs a full **demo mode**: seeded farmers, customers and riders around Kochi live in your browser, riders drive along real roads by simulation, and you can switch between all four roles in one click.

---

## Highlights

| Role | What they get |
| --- | --- |
| **Customer** | Order with a map-pinned address, wallet or cash, subscriptions (pause/resume), **live tracking** with ETA and a 4-digit delivery code, self-service cancellation with instant refund |
| **Rider** | Today's route optimised across all stops, road route on the map, one-tap Google Maps navigation, call customer, GPS sharing, **OTP hand-off**, claim waiting orders, milk collection with quality check |
| **Farmer** | Earnings overview, contribution history with PDF statement, date-effective pay, payment requests, wallet, weekly reports |
| **Admin** | **Live Ops** dispatch map (riders + open orders, manual/auto-assign), orders, farmer approvals & blacklist, payment review, collections, inventory & archive, pricing history, reports from real data |

Plus: redesigned "fresh dairy" UI with dark mode, responsive layouts with a mobile bottom bar, in-app notifications and realtime updates.

---

## Quick start

```sh
npm install
npm run dev          # http://localhost:8080
```

Requires **Node 20.19+** (Vite 7). With no `.env`, the app starts in demo mode — open `/auth/customer` and pick a role.

| Script | Purpose |
| --- | --- |
| `npm run dev` | Dev server on port 8080 |
| `npm run build` | Production build (works with or without env vars) |
| `npm run preview` | Serve the production build |
| `npm test` | Unit tests (Vitest) |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint |

## Deploy to Vercel

1. Import the repository in Vercel (framework preset **Vite** is detected; `vercel.json` adds SPA rewrites, asset caching and security headers).
2. **Demo:** deploy with no environment variables — you get the full demo.
3. **Live:** add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Project → Settings → Environment Variables) and redeploy. Set `VITE_DEMO_MODE=true` to force the demo even when keys are present.

## Configuration

All variables are optional — see [`.env.example`](.env.example).

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | — | Live backend. Missing ⇒ demo mode |
| `VITE_DEMO_MODE` | `false` | Force demo mode |
| `VITE_MAP_CENTER` | `9.9816,76.2999` (Kochi) | Map centre; the demo city moves with it |
| `VITE_MAP_TILE_URL` / `VITE_MAP_TILE_ATTRIBUTION` | OpenStreetMap | Raster tiles. Use your own provider for production traffic |
| `VITE_OSRM_URL` | `router.project-osrm.org` | Road routing (falls back to straight-line estimates) |
| `VITE_NOMINATIM_URL` | `nominatim.openstreetmap.org` | Address search / reverse geocoding |

> The public OSM tile, OSRM and Nominatim servers are fine for demos but have fair-use limits. For production, self-host them or use a commercial provider and point the variables above at it.

## Live backend (Supabase)

Apply the migrations to a **fresh** project, in order (SQL editor or `supabase db push`):

```
supabase/migrations/20260711000001_secure_rebuild.sql   # schema, RLS, atomic RPCs, seed products
supabase/migrations/20260712000001_delivery_maps.sql    # locations, OTP, dispatch, tracking, realtime
```

Deploy the Edge Function used by **Admin → Farmers → Register farmer**:

```sh
supabase functions deploy admin-create-farmer
```

Create the first admin (admins can't self-register):

```sql
insert into public.admin_allowlist (email) values ('you@example.com');   -- then sign up at /auth/admin
-- or promote an existing user
update public.profiles set user_type = 'admin' where email = 'you@example.com';
```

Optional nightly jobs (`pg_cron`): uncomment the schedules at the end of both migrations to archive stock, reserve subscription demand and bill subscriptions automatically. Update the seeded row in `public.depots` to your hub's location.

## Architecture

```
src/
  config/env.ts            env parsing, demo-mode switch, map/routing endpoints
  services/
    api.ts, types.ts       DataApi contract + domain types (UI depends only on these)
    supabase/              live backend: queries, RPCs, realtime
    mock/                  demo backend: seed, rules, localStorage store, rider simulator
  hooks/api/               TanStack Query hooks + realtime cache invalidation
  components/
    layout/                AppShell (sidebar, top bar, bottom nav), notifications
    maps/                  BaseMap, markers, animated rider, route line, location picker
    common/ orders/ ...    shared UI building blocks
  pages/{admin,farmer,customer,delivery}/   route-level, lazy-loaded screens
  lib/                     formatting, geo, OSRM routing + stop optimisation, PDF, analytics
supabase/
  migrations/              authoritative schema
  functions/               Edge Functions
```

Every screen talks to a single `DataApi` interface. In live mode it's implemented with Supabase (RLS + `SECURITY DEFINER` RPCs); in demo mode an in-browser implementation applies the **same business rules** (stock checks, wallet debits/refunds, the three-strike quality gate, date-effective farmer pricing, OTP checks) — covered by unit tests.

## Security model

- **Roles** live in `profiles.user_type` and are never client-writable; a trigger blocks role/status changes by non-admins, and admin sign-ups require the allowlist.
- **Money and stock** only move inside atomic, role-checked RPCs (advisory-locked per wallet). Clients cannot write wallets, orders or payments directly.
- **Delivery OTPs** live in a separate `order_otps` table readable only by the ordering customer — riders can read orders but never the code.
- **Rider locations** are visible to admins, the rider, and a customer only while that rider has their order in progress.
- **Creating users** for others happens in an Edge Function with the service role, after verifying the caller is an admin.

See [`docs/ROADMAP.md`](docs/ROADMAP.md) for what's next.
