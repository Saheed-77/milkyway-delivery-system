# MilkyWay roadmap

Status key: ✅ shipped · 🟡 suggested next · 🔭 later

## Shipped in this release

### Delivery & maps
- ✅ Live rider tracking for customers (road route, ETA countdown, rider contact)
- ✅ Rider "Today's route": nearest-neighbour + 2-opt stop ordering, OSRM road route, one-tap navigation, arrival detection
- ✅ OTP proof of delivery (codes stored separately from orders so riders can't read them)
- ✅ Admin Live Ops dispatch map — manual assignment, auto-assign to the nearest rider with capacity
- ✅ Map-pinned delivery addresses (search, GPS, draggable pin) at sign-up, checkout and in settings
- ✅ Subscription billing into delivery orders (`generate_subscription_orders`)
- ✅ Realtime updates (Supabase Realtime in live mode, store events in the demo)

### Product & UX
- ✅ Full UI redesign with dark mode, responsive layouts and a mobile bottom bar
- ✅ Built-in demo mode (no backend) with one-click role switching — deployable to Vercel as-is
- ✅ Customer self-service cancellation with instant wallet refund
- ✅ In-app notifications, branded PDF exports, real analytics

### Bugs fixed
- Admin orders, completed deliveries, delivery schedule and delivery stats queried columns that don't exist (`delivery_slot`, `updated_at`) and used an ambiguous `profiles` embed — those pages never loaded
- Hardcoded legacy Supabase URL/anon key and a call to a non-existent RPC on every admin dashboard load
- Third-party editor script injected on every page (including login)
- Admin "Register farmer" signed the admin out and failed on duplicate/generated columns → Edge Function
- Admin complete/cancel bypassed the RPCs: no refunds, no stock restore
- Cash orders shown as "Wallet" (`"cod"` vs `"cash"`); debits shown without an icon (`'order'` vs `'withdrawal'`)
- "Paid" badge never shown (`'completed'` vs `'approved'`); farmer "Total earned" only summed the last 5 payments
- Subscriptions always saved as cow milk; quantity unvalidated; never billed
- Pricing form overwrote every historical price, breaking date-based farmer pay
- Repeated "reserve stock" clicks stacked reservations and could block all orders
- Blacklist tab was always empty (filtered from approved farmers)
- Reports page plotted hardcoded mock data and parsed locale strings back into dates
- IST dates shifted a day (`toISOString().split("T")`); fractional demand printed as `0.142857…L`
- PDFs printed garbage for ₹ (no glyph in Helvetica); long subtitles ran off the page
- Weekly report tooltips never formatted; "+100%" shown when both weeks were zero
- Date filter could disappear and trap the user; end date excluded
- No way to open the sidebar on phones; tables overflowed; extra 64 px scroll on every dashboard
- Post-login redirect could bounce to `/`; delivery Settings route had no page; nested `<a><button>` on the landing page
- `milk_stock` `.single()` broke after day two; quick-order showed inactive products and the wrong price

## Suggested next

### Payments & money
- 🟡 Razorpay / UPI payment gateway; credit wallets only from a verified webhook (replace the demo recharge)
- 🟡 GST-compliant invoices and monthly statements by email
- 🔭 Auto-recharge and low-balance reminders before subscription billing

### Customers
- 🟡 Delivery time-slot selection (the `delivery_slots` table already exists)
- 🟡 Vacation mode / skip-a-day for subscriptions
- 🟡 Ratings and feedback per delivery; issue reporting (spilt/late/missing)
- 🔭 Referral credits and promo codes

### Delivery operations
- 🟡 Photo proof of delivery (Supabase Storage) as an alternative to OTP
- 🟡 Geofenced auto-"arrived" and customer "rider is 2 minutes away" push
- 🟡 Rider PWA with offline queue and background location
- 🟡 Push / WhatsApp / SMS notifications (order status, payment approved)
- 🔭 Capacity-aware multi-rider route planning (VRP) and shift scheduling

### Farmers & supply
- 🟡 Fat/SNF-based pricing and lab-test results per collection
- 🟡 Farmer collection-route planning for pickup vans
- 🔭 Bottle/can return tracking and deposits

### Admin & analytics
- 🟡 Demand forecasting from the stock archive and subscription trends
- 🟡 Audit log for admin actions (status changes, price changes, manual completions)
- 🔭 Multi-depot support (the `depots` table is ready)

### Platform & engineering
- 🟡 GitHub Actions CI: typecheck, lint, tests, build on every PR
- 🟡 Playwright end-to-end tests against demo mode
- 🟡 Generate Supabase types in CI instead of hand-maintaining them
- 🟡 Error monitoring (Sentry) and web-vitals reporting
- 🔭 i18n (Malayalam, Hindi) and full WCAG 2.1 AA audit
