/**
 * Demo backend: implements DataApi entirely in the browser and enforces the
 * same rules as the Postgres RPCs (stock checks, wallet debits/refunds, the
 * three-strike quality gate, date-effective farmer pricing, OTP delivery).
 */
import { addDays, fullName, round2, toLocalISODate } from "@/lib/format";
import { haversine } from "@/lib/geo";
import type { ChangeTopic, DataApi } from "../api";
import type {
  AccountStatus,
  AppNotification,
  Contribution,
  DateRange,
  Farmer,
  FarmerPayment,
  MilkPrice,
  MilkType,
  Order,
  Profile,
  QualityRating,
  Rider,
  StockSummary,
  Subscription,
  UserRole,
} from "../types";
import { MILK_TYPES } from "../types";
import { DEMO_ACCOUNTS, uid, type DbNotification, type DbOrder, type DbProfile, type DemoDb } from "./db";
import { getStore } from "./store";

// Lazily created so live mode never touches demo storage.
const st = () => getStore();
const db = (): DemoDb => st().db;

/* ---------------------------------------------------------------- utils */

const latency = () => new Promise((r) => setTimeout(r, 120 + Math.random() * 200));
const clone = <T,>(v: T): T => (typeof structuredClone === "function" ? structuredClone(v) : JSON.parse(JSON.stringify(v)));
const today = () => toLocalISODate();
const nowIso = () => new Date().toISOString();
const dateOf = (iso: string) => toLocalISODate(new Date(iso));
const inRange = (date: string, range?: DateRange) =>
  (!range?.from || date >= range.from) && (!range?.to || date <= range.to);

class DemoError extends Error {}
const fail = (message: string): never => {
  throw new DemoError(message);
};

function me(): DbProfile {
  const id = st().sessionUserId;
  const profile = id ? db().profiles.find((p) => p.id === id) : undefined;
  if (!profile) fail("Not authenticated");
  return profile!;
}

function requireRole(...roles: UserRole[]): DbProfile {
  const p = me();
  if (!roles.includes(p.user_type)) fail("You do not have permission to do that");
  return p;
}

function requireApprovedFarmer(): DbProfile {
  const p = requireRole("farmer");
  if (p.status !== "approved") fail("Only approved farmers may do that");
  return p;
}

const toProfile = (p: DbProfile): Profile => {
  const { password: _pw, license_number: _ln, ...rest } = p;
  return clone(rest);
};

function notify(n: Omit<DbNotification, "id" | "created_at">) {
  db().notifications.unshift({ ...n, id: uid("n"), created_at: nowIso() });
  db().notifications.splice(200);
}

const balanceOf = (userId: string) =>
  round2(
    db()
      .wallet.filter((t) => t.user_id === userId && t.status === "completed")
      .reduce((s, t) => s + (t.transaction_type === "deposit" ? t.amount : -t.amount), 0)
  );

function stockRow(date = today()) {
  let row = db().stock.find((s) => s.date === date);
  if (!row) {
    row = { date, total_stock: 0 };
    db().stock.push(row);
  }
  return row;
}

const reservedOn = (date: string) =>
  db()
    .reservations.filter((r) => r.reservation_date === date)
    .reduce((s, r) => s + r.reserved_amount, 0);

const subscriptionDemand = () =>
  db()
    .subscriptions.filter((s) => s.status === "active")
    .reduce(
      (s, x) => s + (x.frequency === "daily" ? x.quantity : x.frequency === "weekly" ? x.quantity / 7 : x.quantity / 30),
      0
    );

function priceOn(milk: MilkType, date: string): number {
  return (
    db()
      .pricing.filter((p) => p.milk_type === milk && p.effective_from <= date)
      .sort((a, b) => b.effective_from.localeCompare(a.effective_from) || 0)[0]?.price_per_liter ?? 0
  );
}

const profileById = (id: string | null | undefined) => (id ? db().profiles.find((p) => p.id === id) : undefined);

function toOrder(o: DbOrder, viewer?: DbProfile): Order {
  const items = db()
    .orderItems.filter((i) => i.order_id === o.id)
    .map((i) => {
      const product = db().products.find((p) => p.id === i.product_id);
      return {
        product_id: i.product_id,
        product_name: product?.name ?? "Milk",
        milk_type: (product?.milk_type ?? "cow") as MilkType,
        quantity: i.quantity,
        unit_price: i.unit_price,
      };
    });
  const customer = profileById(o.customer_id);
  const rider = profileById(o.delivery_person_id);
  const canSeeOtp = viewer?.id === o.customer_id;
  return {
    id: o.id,
    customer_id: o.customer_id,
    customer_name: fullName(customer),
    customer_phone: customer?.phone ?? null,
    total_amount: o.total_amount,
    status: o.status,
    payment_method: o.payment_method,
    delivery_person_id: o.delivery_person_id,
    rider_name: rider ? fullName(rider) : null,
    delivery_address: o.delivery_address,
    delivery_lat: o.delivery_lat,
    delivery_lng: o.delivery_lng,
    delivery_notes: o.delivery_notes,
    delivery_otp: canSeeOtp ? o.delivery_otp : null,
    assigned_at: o.assigned_at,
    picked_up_at: o.picked_up_at,
    delivered_at: o.delivered_at,
    created_at: o.created_at,
    items,
    quantity: items.reduce((s, i) => s + i.quantity, 0),
    source: o.source,
  };
}

function toFarmer(p: DbProfile): Farmer {
  const f = db().farmers.find((x) => x.id === p.id);
  return {
    id: p.id,
    farmer_code: f?.farmer_code ?? 0,
    first_name: p.first_name,
    last_name: p.last_name,
    name: fullName(p),
    email: p.email,
    phone: p.phone,
    status: p.status,
    farm_name: f?.farm_name ?? "Unnamed Farm",
    farm_location: f?.farm_location ?? null,
    production_capacity: f?.production_capacity ?? null,
    latitude: p.latitude,
    longitude: p.longitude,
    created_at: p.created_at,
  };
}

function toContribution(c: DemoDb["contributions"][number]): Contribution {
  const p = profileById(c.farmer_id);
  const payment = c.payment_id ? db().payments.find((x) => x.id === c.payment_id) : undefined;
  return {
    id: c.id,
    farmer_id: c.farmer_id,
    farmer_name: fullName(p),
    farmer_code: db().farmers.find((f) => f.id === c.farmer_id)?.farmer_code ?? null,
    quantity: c.quantity,
    milk_type: c.milk_type,
    quality_rating: c.quality_rating,
    contribution_date: c.contribution_date,
    payment_id: c.payment_id,
    payment_status: payment?.status ?? null,
    value: round2(c.quantity * priceOn(c.milk_type, c.contribution_date)),
    created_at: c.created_at,
  };
}

function toPayment(p: DemoDb["payments"][number]): FarmerPayment {
  const rows = db().contributions.filter((c) => c.payment_id === p.id);
  return {
    id: p.id,
    farmer_id: p.farmer_id,
    farmer_name: fullName(profileById(p.farmer_id)),
    farmer_code: db().farmers.find((f) => f.id === p.farmer_id)?.farmer_code ?? null,
    amount: p.amount,
    status: p.status,
    payment_date: p.payment_date,
    approved_at: p.approved_at,
    created_at: p.created_at,
    liters: round2(rows.reduce((s, c) => s + c.quantity, 0)),
    contribution_count: rows.length,
  };
}

const sortDesc = <T extends { created_at: string }>(rows: T[]) =>
  rows.sort((a, b) => b.created_at.localeCompare(a.created_at));

function findOrder(id: string): DbOrder {
  const o = db().orders.find((x) => x.id === id);
  if (!o) fail("Order not found");
  return o!;
}

const genOtp = () => String(1000 + Math.floor(Math.random() * 9000));

function restoreStock(orderId: string) {
  const qty = db()
    .orderItems.filter((i) => i.order_id === orderId)
    .reduce((s, i) => s + i.quantity, 0);
  stockRow().total_stock = round2(stockRow().total_stock + qty);
}

/* ---------------------------------------------------------------- api */

export const mockApi: DataApi = {
  mode: "demo",

  auth: {
    async getProfile() {
      const id = st().sessionUserId;
      const p = id ? profileById(id) : undefined;
      return p ? toProfile(p) : null;
    },
    onChange(cb) {
      return st().onAuth(() => {
        const p = profileById(st().sessionUserId);
        cb(p ? toProfile(p) : null);
      });
    },
    async signIn(email, password) {
      await latency();
      const p = db().profiles.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
      if (!p || (p.password && p.password !== password)) fail("Invalid login credentials");
      st().setSession(p!.id);
      return toProfile(p!);
    },
    async demoSignIn(role) {
      await latency();
      const p = db().profiles.find((x) => x.email === DEMO_ACCOUNTS[role]);
      if (!p) fail("Demo account missing — reset the demo data");
      st().setSession(p!.id);
      return toProfile(p!);
    },
    async signUp(input) {
      await latency();
      const email = input.email.trim().toLowerCase();
      if (db().profiles.some((p) => p.email.toLowerCase() === email)) fail("User already registered");
      if (input.role === "admin") fail("Admin accounts cannot be self-registered");
      const id = uid("u");
      const profile: DbProfile = {
        id,
        email,
        user_type: input.role,
        status: input.role === "farmer" ? "pending" : "approved",
        first_name: input.firstName.trim(),
        last_name: input.lastName.trim(),
        phone: input.phone?.trim() || null,
        address: input.address?.trim() || input.farmLocation?.trim() || null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        created_at: nowIso(),
        password: input.password,
        license_number: input.licenseNumber ?? null,
      };
      db().profiles.push(profile);
      if (input.role === "farmer") {
        db().farmers.push({
          id,
          farmer_code: db().nextFarmerCode++,
          farm_name: input.farmName?.trim() || "Unnamed Farm",
          farm_location: input.farmLocation?.trim() || null,
          production_capacity: null,
        });
        notify({
          audience: "admin",
          title: "New farmer registration",
          body: `${fullName(profile)} (${input.farmName}) is awaiting approval.`,
          kind: "system",
          link: "/dashboard/admin/farmers",
        });
        st().commit("farmers");
        return { active: false, message: "Registration submitted. An admin will review it shortly." };
      }
      st().commit("farmers");
      st().setSession(id);
      return { active: true, message: "Account created — you're signed in." };
    },
    async signOut() {
      st().setSession(null);
    },
    async updateProfile(patch) {
      await latency();
      const p = me();
      Object.assign(p, patch);
      st().commit("orders");
      st().setSession(p.id);
      return toProfile(p);
    },
  },

  products: {
    async list(opts) {
      await latency();
      return clone(db().products.filter((p) => opts?.includeInactive || p.is_active));
    },
    async update(id, patch) {
      await latency();
      requireRole("admin");
      const p = db().products.find((x) => x.id === id);
      if (!p) fail("Product not found");
      if (patch.price !== undefined && !(patch.price > 0)) fail("Price must be greater than zero");
      Object.assign(p!, patch);
      st().commit("pricing");
    },
  },

  wallet: {
    async balance() {
      await latency();
      return balanceOf(me().id);
    },
    async transactions(limit = 100) {
      await latency();
      const uidMe = me().id;
      return clone(sortDesc(db().wallet.filter((t) => t.user_id === uidMe)).slice(0, limit));
    },
    async recharge(amount) {
      await latency();
      const p = me();
      if (!(amount > 0) || amount > 100000) fail("Invalid recharge amount");
      db().wallet.push({
        id: uid("wt"),
        user_id: p.id,
        amount: round2(amount),
        transaction_type: "deposit",
        status: "completed",
        description: "Wallet recharge",
        order_id: null,
        created_at: nowIso(),
      });
      st().commit("wallet");
    },
  },

  orders: {
    async place(input) {
      await latency();
      const p = me();
      const qty = Number(input.quantity);
      if (!(qty > 0) || qty > 100) fail("Quantity must be between 1 and 100");
      if (!MILK_TYPES.includes(input.milkType)) fail("Invalid milk type or payment method");
      const product = db()
        .products.filter((x) => x.milk_type === input.milkType && x.is_active)
        .sort((a, b) => a.price - b.price)[0];
      if (!product) fail(`No ${input.milkType} milk products available`);
      const total = round2(product!.price * qty);
      const row = stockRow();
      if (row.total_stock - reservedOn(today()) < qty) fail("Insufficient stock available today");
      if (input.paymentMethod === "wallet") {
        const bal = balanceOf(p.id);
        if (bal < total) fail(`Insufficient wallet balance. Need ₹${(total - bal).toFixed(2)} more.`);
      }
      const lat = input.lat ?? p.latitude;
      const lng = input.lng ?? p.longitude;
      const order: DbOrder = {
        id: uid("ord"),
        customer_id: p.id,
        total_amount: total,
        status: "pending",
        payment_method: input.paymentMethod,
        delivery_person_id: null,
        delivery_address: input.address?.trim() || p.address,
        delivery_lat: lat ?? null,
        delivery_lng: lng ?? null,
        delivery_notes: input.notes?.trim() || null,
        delivery_otp: genOtp(),
        assigned_at: null,
        picked_up_at: null,
        delivered_at: null,
        created_at: nowIso(),
        source: "order",
      };
      db().orders.push(order);
      db().orderItems.push({ id: uid("oi"), order_id: order.id, product_id: product!.id, quantity: qty, unit_price: product!.price });
      if (input.paymentMethod === "wallet") {
        db().wallet.push({
          id: uid("wt"),
          user_id: p.id,
          amount: total,
          transaction_type: "withdrawal",
          status: "completed",
          description: "Order payment",
          order_id: order.id,
          created_at: nowIso(),
        });
      }
      row.total_stock = round2(row.total_stock - qty);
      notify({
        audience: "admin",
        title: "New order",
        body: `${fullName(p)} ordered ${qty} L of ${input.milkType} milk.`,
        kind: "order",
        link: "/dashboard/admin/live",
      });
      st().commit("orders", "wallet", "stock");
      return order.id;
    },

    async mine() {
      await latency();
      const p = me();
      return sortDesc(db().orders.filter((o) => o.customer_id === p.id).map((o) => toOrder(o, p)));
    },

    async cancel(orderId) {
      await latency();
      const p = me();
      const o = findOrder(orderId);
      if (o.customer_id !== p.id && p.user_type !== "admin") fail("Not allowed");
      if (o.status !== "pending") fail("Only pending orders can be cancelled");
      o.status = "cancelled";
      if (o.payment_method === "wallet") {
        db().wallet.push({
          id: uid("wt"),
          user_id: o.customer_id,
          amount: o.total_amount,
          transaction_type: "deposit",
          status: "completed",
          description: "Refund for cancelled order",
          order_id: o.id,
          created_at: nowIso(),
        });
      }
      restoreStock(o.id);
      if (o.delivery_person_id) {
        notify({ audience: o.delivery_person_id, title: "Stop cancelled", body: `An order for ${o.delivery_address} was cancelled.`, kind: "delivery", link: "/dashboard/delivery" });
      }
      st().commit("orders", "wallet", "stock");
    },

    async tracking(orderId) {
      await latency();
      const p = me();
      const o = findOrder(orderId);
      const allowed = o.customer_id === p.id || p.user_type === "admin" || (p.user_type === "delivery" && o.delivery_person_id === p.id);
      if (!allowed) fail("Order not found");
      const rider = profileById(o.delivery_person_id);
      const location =
        rider && (o.status === "out_for_delivery" || o.status === "pending")
          ? db().riderLocations.find((l) => l.rider_id === rider.id) ?? null
          : null;
      return clone({
        order: toOrder(o, p),
        rider: rider ? { id: rider.id, name: fullName(rider), phone: rider.phone } : null,
        location,
        depot: db().depot,
      });
    },

    async all(filter) {
      await latency();
      const p = requireRole("admin");
      return sortDesc(
        db()
          .orders.filter((o) => !filter?.status || filter.status === "all" || o.status === filter.status)
          .filter((o) => inRange(dateOf(o.created_at), filter?.range))
          .map((o) => toOrder(o, p))
      );
    },

    async forceComplete(orderId) {
      await latency();
      requireRole("admin");
      const o = findOrder(orderId);
      if (o.status !== "pending" && o.status !== "out_for_delivery") fail(`Order is not deliverable (status: ${o.status})`);
      o.status = "completed";
      o.delivered_at = nowIso();
      notify({ audience: o.customer_id, title: "Order delivered", body: "Your milk has been delivered. Enjoy!", kind: "delivery", link: "/dashboard/customer/orders" });
      st().commit("orders");
    },
  },

  subscriptions: {
    async mine() {
      await latency();
      const p = me();
      return sortDesc(
        db()
          .subscriptions.filter((s) => s.customer_id === p.id)
          .map<Subscription>((s) => ({
            id: s.id,
            product_id: s.product_id,
            product_name: db().products.find((x) => x.id === s.product_id)?.name ?? `${s.milk_type} milk`,
            milk_type: s.milk_type,
            quantity: s.quantity,
            frequency: s.frequency,
            status: s.status,
            next_delivery: s.next_delivery,
            created_at: s.created_at,
          }))
      );
    },
    async create(input) {
      await latency();
      const p = requireRole("customer");
      const product = db().products.find((x) => x.id === input.productId && x.is_active);
      if (!product) fail("Choose an available product");
      if (!(input.quantity > 0) || input.quantity > 50) fail("Quantity must be between 0.5 and 50 liters");
      db().subscriptions.push({
        id: uid("sub"),
        customer_id: p.id,
        product_id: product!.id,
        milk_type: product!.milk_type,
        quantity: input.quantity,
        frequency: input.frequency,
        status: "active",
        next_delivery: addDays(new Date(), 1).toISOString(),
        created_at: nowIso(),
      });
      st().commit("subscriptions", "stock");
    },
    async setStatus(id, status) {
      await latency();
      const p = me();
      const s = db().subscriptions.find((x) => x.id === id);
      if (!s || (s.customer_id !== p.id && p.user_type !== "admin")) fail("Subscription not found");
      if (s!.status === "cancelled") fail("Cancelled subscriptions cannot be changed");
      s!.status = status;
      st().commit("subscriptions", "stock");
    },
    async generateOrders(date = today()) {
      await latency();
      requireRole("admin");
      const d = new Date(`${date}T07:00:00`);
      let created = 0;
      for (const s of db().subscriptions.filter((x) => x.status === "active")) {
        const start = new Date(s.created_at);
        const due =
          s.frequency === "daily" ||
          (s.frequency === "weekly" && start.getDay() === d.getDay()) ||
          (s.frequency === "monthly" && start.getDate() === d.getDate());
        if (!due) continue;
        if (db().orders.some((o) => o.subscription_id === s.id && dateOf(o.created_at) === date)) continue;
        const product = db().products.find((x) => x.id === s.product_id) ?? db().products.find((x) => x.milk_type === s.milk_type);
        const customer = profileById(s.customer_id);
        if (!product || !customer) continue;
        const total = round2(product.price * s.quantity);
        if (balanceOf(customer.id) < total) {
          notify({ audience: customer.id, title: "Subscription delivery skipped", body: `Recharge your wallet — ₹${total.toFixed(2)} needed for ${s.quantity} L.`, kind: "payment", link: "/dashboard/customer/wallet" });
          continue;
        }
        const order: DbOrder = {
          id: uid("ord"),
          customer_id: customer.id,
          total_amount: total,
          status: "pending",
          payment_method: "wallet",
          delivery_person_id: null,
          delivery_address: customer.address,
          delivery_lat: customer.latitude,
          delivery_lng: customer.longitude,
          delivery_notes: null,
          delivery_otp: genOtp(),
          assigned_at: null,
          picked_up_at: null,
          delivered_at: null,
          created_at: nowIso(),
          source: "subscription",
          subscription_id: s.id,
        };
        db().orders.push(order);
        db().orderItems.push({ id: uid("oi"), order_id: order.id, product_id: product.id, quantity: s.quantity, unit_price: product.price });
        db().wallet.push({ id: uid("wt"), user_id: customer.id, amount: total, transaction_type: "withdrawal", status: "completed", description: "Subscription delivery", order_id: order.id, created_at: nowIso() });
        stockRow().total_stock = round2(Math.max(0, stockRow().total_stock - s.quantity));
        const res = db().reservations.find((r) => r.reservation_date === date);
        if (res) res.reserved_amount = Math.max(0, round2(res.reserved_amount - s.quantity));
        s.next_delivery = addDays(d, s.frequency === "daily" ? 1 : s.frequency === "weekly" ? 7 : 30).toISOString();
        created++;
      }
      st().commit("orders", "wallet", "stock", "subscriptions");
      return created;
    },
  },

  farmers: {
    async list() {
      await latency();
      requireRole("admin", "delivery");
      return sortDesc(db().profiles.filter((p) => p.user_type === "farmer").map(toFarmer));
    },
    async me() {
      await latency();
      const p = me();
      return p.user_type === "farmer" ? toFarmer(p) : null;
    },
    async setStatus(farmerId, status: AccountStatus) {
      await latency();
      requireRole("admin");
      const p = db().profiles.find((x) => x.id === farmerId && x.user_type === "farmer");
      if (!p) fail("Farmer not found");
      p!.status = status;
      notify({
        audience: p!.id,
        title: status === "approved" ? "Account approved" : status === "rejected" ? "Account suspended" : "Account under review",
        body: status === "approved" ? "You can now log in and record milk deliveries." : "Contact the MilkyWay team for details.",
        kind: "system",
      });
      st().commit("farmers");
    },
    async create(input) {
      await latency();
      requireRole("admin");
      const email = input.email.trim().toLowerCase();
      if (db().profiles.some((p) => p.email.toLowerCase() === email)) fail("A user with this email already exists");
      const id = uid("u");
      const profile: DbProfile = {
        id,
        email,
        user_type: "farmer",
        status: "approved",
        first_name: input.firstName.trim(),
        last_name: input.lastName.trim(),
        phone: input.phone?.trim() || null,
        address: input.farmLocation?.trim() || null,
        latitude: null,
        longitude: null,
        created_at: nowIso(),
        password: input.password,
      };
      db().profiles.push(profile);
      db().farmers.push({
        id,
        farmer_code: db().nextFarmerCode++,
        farm_name: input.farmName.trim(),
        farm_location: input.farmLocation?.trim() || null,
        production_capacity: input.productionCapacity ?? null,
      });
      st().commit("farmers");
      return toFarmer(profile);
    },
  },

  contributions: {
    async mine(range) {
      await latency();
      const p = requireRole("farmer");
      return sortDesc(
        db()
          .contributions.filter((c) => c.farmer_id === p.id && inRange(c.contribution_date, range))
          .map(toContribution)
      ).sort((a, b) => b.contribution_date.localeCompare(a.contribution_date));
    },
    async all(range) {
      await latency();
      requireRole("admin", "delivery");
      return sortDesc(db().contributions.filter((c) => inRange(c.contribution_date, range)).map(toContribution)).sort(
        (a, b) => b.contribution_date.localeCompare(a.contribution_date)
      );
    },
    async submitCollection(input) {
      await latency();
      const staff = requireRole("admin", "delivery");
      if (!(input.quantity > 0) || input.quantity > 10000) fail("Invalid quantity");
      if (![1, 2, 3].includes(input.qualityRating)) fail("Quality rating must be between 1 and 3");
      const farmer = db().farmers.find((f) => f.farmer_code === Number(input.farmerCode));
      if (!farmer) fail("Invalid Farmer ID: no farmer found with this ID");
      const profile = profileById(farmer!.id)!;
      if (profile.status !== "approved") fail(`This farmer is not approved (status: ${profile.status})`);
      const name = fullName(profile);
      if (input.qualityRating === 3) {
        let offenses = 1;
        const recent = db()
          .contributions.filter((c) => c.farmer_id === farmer!.id && c.quality_rating !== null)
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .slice(0, 10);
        for (const c of recent) {
          if (c.quality_rating !== 3) break;
          offenses++;
        }
        db().contributions.push({
          id: uid("mc"),
          farmer_id: farmer!.id,
          quantity: 0,
          milk_type: input.milkType,
          quality_rating: 3,
          contribution_date: today(),
          payment_id: null,
          collected_by: staff.id,
          created_at: nowIso(),
        });
        if (offenses >= 3) {
          profile.status = "rejected";
          notify({ audience: "admin", title: "Farmer blacklisted", body: `${name} was blacklisted after ${offenses} substandard submissions.`, kind: "system", link: "/dashboard/admin/farmers" });
          notify({ audience: profile.id, title: "Account suspended", body: "Three consecutive substandard submissions. Contact the MilkyWay team.", kind: "system" });
          st().commit("contributions", "farmers");
          return { outcome: "blacklisted", offense_count: offenses, farmer_name: name, farmer_email: profile.email };
        }
        notify({ audience: profile.id, title: "Milk rejected", body: `Today's milk failed the quality check (strike ${offenses} of 3).`, kind: "system" });
        st().commit("contributions");
        return { outcome: "substandard", offense_count: offenses, farmer_name: name, farmer_email: profile.email };
      }
      db().contributions.push({
        id: uid("mc"),
        farmer_id: farmer!.id,
        quantity: round2(input.quantity),
        milk_type: input.milkType,
        quality_rating: input.qualityRating as QualityRating,
        contribution_date: today(),
        payment_id: null,
        collected_by: staff.id,
        created_at: nowIso(),
      });
      stockRow().total_stock = round2(stockRow().total_stock + input.quantity);
      st().commit("contributions", "stock");
      return { outcome: "recorded", offense_count: 0, farmer_name: name, farmer_email: profile.email };
    },
  },

  payments: {
    async mine() {
      await latency();
      const p = requireRole("farmer");
      return sortDesc(db().payments.filter((x) => x.farmer_id === p.id).map(toPayment));
    },
    async all() {
      await latency();
      requireRole("admin");
      return sortDesc(db().payments.map(toPayment));
    },
    async pendingValue() {
      await latency();
      const p = requireRole("farmer");
      const rows = db().contributions.filter((c) => c.farmer_id === p.id && !c.payment_id);
      return {
        liters: round2(rows.reduce((s, c) => s + c.quantity, 0)),
        amount: round2(rows.reduce((s, c) => s + c.quantity * priceOn(c.milk_type, c.contribution_date), 0)),
      };
    },
    async request() {
      await latency();
      const p = requireApprovedFarmer();
      const rows = db().contributions.filter((c) => c.farmer_id === p.id && !c.payment_id);
      const amount = round2(rows.reduce((s, c) => s + c.quantity * priceOn(c.milk_type, c.contribution_date), 0));
      if (amount <= 0) fail("No unpaid contributions with configured pricing found");
      const payment = {
        id: uid("fp"),
        farmer_id: p.id,
        amount,
        status: "pending" as const,
        payment_date: today(),
        approved_by: null,
        approved_at: null,
        created_at: nowIso(),
      };
      db().payments.push(payment);
      rows.forEach((c) => (c.payment_id = payment.id));
      notify({ audience: "admin", title: "Payment requested", body: `${fullName(p)} requested ₹${amount.toFixed(2)}.`, kind: "payment", link: "/dashboard/admin/payments" });
      st().commit("payments", "contributions");
      return payment.id;
    },
    async review(paymentId, approve) {
      await latency();
      const admin = requireRole("admin");
      const payment = db().payments.find((x) => x.id === paymentId);
      if (!payment) fail("Payment not found");
      if (payment!.status !== "pending") fail("Payment already reviewed");
      payment!.status = approve ? "approved" : "rejected";
      payment!.approved_by = admin.id;
      payment!.approved_at = nowIso();
      if (approve) {
        db().wallet.push({
          id: uid("wt"),
          user_id: payment!.farmer_id,
          amount: payment!.amount,
          transaction_type: "deposit",
          status: "completed",
          description: "Milk contribution payment",
          order_id: null,
          created_at: nowIso(),
        });
      } else {
        db().contributions.forEach((c) => {
          if (c.payment_id === paymentId) c.payment_id = null;
        });
      }
      notify({
        audience: payment!.farmer_id,
        title: approve ? "Payment approved" : "Payment rejected",
        body: approve ? `₹${payment!.amount.toFixed(2)} was credited to your wallet.` : "Your contributions were released; you can request payment again.",
        kind: "payment",
        link: "/dashboard/farmer/payments",
      });
      st().commit("payments", "contributions", "wallet");
    },
  },

  pricing: {
    async current() {
      await latency();
      const result = {} as Record<MilkType, MilkPrice | null>;
      const d = today();
      for (const m of MILK_TYPES) {
        result[m] =
          clone(
            db()
              .pricing.filter((p) => p.milk_type === m && p.effective_from <= d)
              .sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0]
          ) ?? null;
      }
      return result;
    },
    async history() {
      await latency();
      return clone([...db().pricing].sort((a, b) => b.effective_from.localeCompare(a.effective_from)));
    },
    async set(prices) {
      await latency();
      requireRole("admin");
      const d = today();
      for (const [milk, price] of Object.entries(prices) as [MilkType, number][]) {
        if (price === undefined || price === null) continue;
        if (!(price > 0) || price > 10000) fail(`Enter a valid ${milk} price`);
        // one row per milk type per effective date: replace today's, keep history
        db().pricing = db().pricing.filter((p) => !(p.milk_type === milk && p.effective_from === d));
        db().pricing.push({ id: uid("mp"), milk_type: milk, price_per_liter: round2(price), effective_from: d });
      }
      st().commit("pricing");
    },
  },

  stock: {
    async today() {
      await latency();
      const d = today();
      const current = db().stock.find((s) => s.date === d)?.total_stock ?? 0;
      const yesterday = toLocalISODate(addDays(new Date(), -1));
      const leftover = db().archive.find((a) => a.date === yesterday)?.leftover_stock ?? 0;
      const added = db().contributions.filter((c) => c.contribution_date === d).reduce((s, c) => s + c.quantity, 0);
      const demand = subscriptionDemand();
      const reservedToday = reservedOn(d);
      const summary: StockSummary = {
        total_stock: round2(current),
        available_stock: round2(Math.max(0, current - reservedToday)),
        subscription_demand: round2(demand),
        leftover_from_yesterday: round2(leftover),
        sold_stock: round2(Math.max(0, added + leftover - current)),
        reserved_today: round2(reservedToday),
        reserved_tomorrow: round2(reservedOn(toLocalISODate(addDays(new Date(), 1)))),
        date: d,
      };
      return summary;
    },
    async adjust(delta) {
      await latency();
      requireRole("admin", "delivery");
      if (!Number.isFinite(delta) || Math.abs(delta) > 100000) fail("Invalid quantity");
      const row = stockRow();
      row.total_stock = round2(Math.max(0, row.total_stock + delta));
      st().commit("stock");
    },
    async reserveTomorrow() {
      await latency();
      requireRole("admin");
      const tomorrow = toLocalISODate(addDays(new Date(), 1));
      const amount = Math.ceil(subscriptionDemand());
      const existing = db().reservations.find((r) => r.reservation_date === tomorrow && r.reservation_type === "subscription");
      if (existing) existing.reserved_amount = amount;
      else db().reservations.push({ id: uid("sr"), reservation_date: tomorrow, reserved_amount: amount, reservation_type: "subscription" });
      st().commit("stock");
      return amount;
    },
    async archiveAndReset() {
      await latency();
      requireRole("admin");
      const yesterday = toLocalISODate(addDays(new Date(), -1));
      if (db().archive.some((a) => a.date === yesterday)) return false;
      const row = db().stock.find((s) => s.date === yesterday);
      if (!row) return false;
      const demand = subscriptionDemand();
      const leftover = Math.max(0, row.total_stock - demand);
      db().archive.push({ id: uid("ar"), date: yesterday, total_stock: row.total_stock, subscription_demand: round2(demand), leftover_stock: round2(leftover) });
      stockRow().total_stock = round2(stockRow().total_stock + leftover);
      st().commit("stock");
      return true;
    },
    async archive(range) {
      await latency();
      const rows = db()
        .archive.filter((a) => inRange(a.date, range))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, range?.from || range?.to ? undefined : 30);
      return rows.map((a) => ({
        id: a.id,
        date: a.date,
        total_stock: a.total_stock,
        available_stock: round2(Math.max(0, a.total_stock - a.subscription_demand)),
        subscription_demand: a.subscription_demand,
        leftover_milk: a.leftover_stock,
      }));
    },
    async summary(periodDays = 30) {
      await latency();
      const end = toLocalISODate(addDays(new Date(), -1));
      const start = toLocalISODate(addDays(new Date(), -1 - Math.max(1, periodDays)));
      const rows = db().archive.filter((a) => a.date >= start && a.date <= end);
      if (!rows.length) return null;
      const avg = (f: (a: (typeof rows)[number]) => number) => round2(rows.reduce((s, a) => s + f(a), 0) / rows.length);
      return {
        start_date: start,
        end_date: end,
        avg_total_stock: avg((a) => a.total_stock),
        avg_subscription_demand: avg((a) => a.subscription_demand),
        avg_leftover_milk: avg((a) => a.leftover_stock),
        max_total_stock: Math.max(...rows.map((a) => a.total_stock)),
        min_total_stock: Math.min(...rows.map((a) => a.total_stock)),
        total_days: rows.length,
      };
    },
  },

  delivery: {
    async depot() {
      return clone(db().depot);
    },
    async myStops() {
      await latency();
      const p = requireRole("delivery");
      const open = (o: DbOrder) => o.status === "pending" || o.status === "out_for_delivery";
      return {
        assigned: db().orders.filter((o) => o.delivery_person_id === p.id && open(o)).map((o) => toOrder(o, p)),
        available: sortDesc(db().orders.filter((o) => !o.delivery_person_id && o.status === "pending").map((o) => toOrder(o, p))),
      };
    },
    async myCompleted(range) {
      await latency();
      const p = requireRole("delivery");
      return db()
        .orders.filter((o) => o.delivery_person_id === p.id && o.status === "completed" && o.delivered_at && inRange(dateOf(o.delivered_at), range))
        .sort((a, b) => (b.delivered_at ?? "").localeCompare(a.delivered_at ?? ""))
        .map((o) => toOrder(o, p));
    },
    async claim(orderId) {
      await latency();
      const p = requireRole("delivery");
      const o = findOrder(orderId);
      if (o.status !== "pending" || o.delivery_person_id) fail("This order was already taken");
      o.delivery_person_id = p.id;
      o.assigned_at = nowIso();
      notify({ audience: o.customer_id, title: "Rider assigned", body: `${fullName(p)} will deliver your order.`, kind: "delivery", link: `/dashboard/customer/track/${o.id}` });
      st().commit("orders");
    },
    async start(orderId) {
      await latency();
      const p = requireRole("delivery");
      const o = findOrder(orderId);
      if (o.delivery_person_id !== p.id) fail("This order is not assigned to you");
      if (o.status !== "pending") fail(`Order cannot be started (status: ${o.status})`);
      o.status = "out_for_delivery";
      o.picked_up_at = nowIso();
      notify({ audience: o.customer_id, title: "Your milk is on the way", body: `${fullName(p)} picked up your order. Track it live.`, kind: "delivery", link: `/dashboard/customer/track/${o.id}` });
      st().commit("orders");
    },
    async complete(orderId, otpCode) {
      await latency();
      const p = requireRole("delivery", "admin");
      const o = findOrder(orderId);
      if (p.user_type === "delivery" && o.delivery_person_id && o.delivery_person_id !== p.id) fail("This order is not assigned to you");
      if (o.status !== "pending" && o.status !== "out_for_delivery") fail(`Order is not deliverable (status: ${o.status})`);
      if (String(otpCode).trim() !== o.delivery_otp) fail("Incorrect delivery code — ask the customer for the 4-digit code");
      o.status = "completed";
      o.delivered_at = nowIso();
      o.delivery_person_id = o.delivery_person_id ?? p.id;
      notify({ audience: o.customer_id, title: "Order delivered", body: "Your milk has been delivered. Enjoy!", kind: "delivery", link: "/dashboard/customer/orders" });
      st().commit("orders");
    },
    async updateLocation(loc) {
      const p = requireRole("delivery");
      const existing = db().riderLocations.find((l) => l.rider_id === p.id);
      const next = { rider_id: p.id, lat: loc.lat, lng: loc.lng, heading: loc.heading ?? null, speed: loc.speed ?? null, updated_at: nowIso() };
      if (existing) Object.assign(existing, next);
      else db().riderLocations.push(next);
      st().commit("rider_locations");
    },
    async riders() {
      await latency();
      requireRole("admin");
      const d = today();
      return db()
        .profiles.filter((p) => p.user_type === "delivery")
        .map<Rider>((p) => ({
          id: p.id,
          name: fullName(p),
          phone: p.phone,
          location: clone(db().riderLocations.find((l) => l.rider_id === p.id) ?? null),
          active_orders: db().orders.filter((o) => o.delivery_person_id === p.id && (o.status === "pending" || o.status === "out_for_delivery")).length,
          completed_today: db().orders.filter((o) => o.delivery_person_id === p.id && o.status === "completed" && o.delivered_at && dateOf(o.delivered_at) === d).length,
        }));
    },
    async assign(orderId, riderId) {
      await latency();
      requireRole("admin");
      const o = findOrder(orderId);
      if (o.status !== "pending") fail("Only pending orders can be (re)assigned");
      if (riderId && !db().profiles.some((p) => p.id === riderId && p.user_type === "delivery")) fail("Rider not found");
      const previous = o.delivery_person_id;
      o.delivery_person_id = riderId;
      o.assigned_at = riderId ? nowIso() : null;
      if (riderId) {
        notify({ audience: riderId, title: "New stop assigned", body: `${o.delivery_address ?? "A customer"} was added to your route.`, kind: "delivery", link: "/dashboard/delivery" });
        notify({ audience: o.customer_id, title: "Rider assigned", body: `${fullName(profileById(riderId))} will deliver your order.`, kind: "delivery", link: `/dashboard/customer/track/${o.id}` });
      }
      if (previous && previous !== riderId) {
        notify({ audience: previous, title: "Stop reassigned", body: `${o.delivery_address ?? "A stop"} was moved to another rider.`, kind: "delivery" });
      }
      st().commit("orders");
    },
    async autoAssign() {
      await latency();
      requireRole("admin");
      return autoAssignOrders();
    },
    async locations() {
      await latency();
      return clone(db().riderLocations);
    },
  },

  reports: {
    async dataset(days) {
      await latency();
      const p = requireRole("admin");
      const from = toLocalISODate(addDays(new Date(), -days + 1));
      return {
        orders: db().orders.filter((o) => dateOf(o.created_at) >= from).map((o) => toOrder(o, p)),
        contributions: db().contributions.filter((c) => c.contribution_date >= from).map(toContribution),
        signups: db()
          .profiles.filter((x) => dateOf(x.created_at) >= toLocalISODate(addDays(new Date(), -Math.max(days, 90))))
          .map((x) => ({ id: x.id, user_type: x.user_type, created_at: x.created_at })),
      };
    },
  },

  notifications: {
    async recent() {
      const id = st().sessionUserId;
      const p = profileById(id);
      if (!p) return [];
      return clone(
        db()
          .notifications.filter((n) => n.audience === p.id || n.audience === p.user_type)
          .slice(0, 20)
          .map<AppNotification>(({ audience: _a, ...n }) => n)
      );
    },
  },

  subscribe(topics, cb) {
    return st().subscribe(topics, cb);
  },
};

/** Nearest rider (by current position) with spare capacity. Shared with the simulator. */
export function autoAssignOrders(maxPerRider = 6, excludeRiderIds: string[] = []): number {
  const riders = db().profiles.filter((p) => p.user_type === "delivery" && !excludeRiderIds.includes(p.id));
  const load = new Map(
    riders.map((r) => [r.id, db().orders.filter((o) => o.delivery_person_id === r.id && (o.status === "pending" || o.status === "out_for_delivery")).length])
  );
  let count = 0;
  const waiting = db()
    .orders.filter((o) => o.status === "pending" && !o.delivery_person_id && o.delivery_lat != null && o.delivery_lng != null)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  for (const o of waiting) {
    const dest = { lat: o.delivery_lat!, lng: o.delivery_lng! };
    const best = riders
      .filter((r) => (load.get(r.id) ?? 0) < maxPerRider)
      .map((r) => {
        const loc = db().riderLocations.find((l) => l.rider_id === r.id) ?? db().depot;
        return { r, d: haversine(loc, dest) + (load.get(r.id) ?? 0) * 800 };
      })
      .sort((a, b) => a.d - b.d)[0];
    if (!best) break;
    o.delivery_person_id = best.r.id;
    o.assigned_at = nowIso();
    load.set(best.r.id, (load.get(best.r.id) ?? 0) + 1);
    notify({ audience: best.r.id, title: "New stop assigned", body: `${o.delivery_address ?? "A customer"} was added to your route.`, kind: "delivery", link: "/dashboard/delivery" });
    notify({ audience: o.customer_id, title: "Rider assigned", body: `${fullName(best.r)} will deliver your order.`, kind: "delivery", link: `/dashboard/customer/track/${o.id}` });
    count++;
  }
  if (count) st().commit("orders");
  return count;
}

export const resetDemoData = () => getStore().reset();

export type { ChangeTopic };
