/**
 * Deterministic demo data around Kochi (or VITE_MAP_CENTER), generated
 * relative to "now" so the demo always shows a live-looking day: orders
 * waiting for dispatch, riders on the road, farmers awaiting payment.
 */
import { MAP_CENTER } from "@/config/env";
import { addDays, round2, toLocalISODate } from "@/lib/format";
import { DEFAULT_SLOT_CAPACITY, DEFAULT_WINDOWS } from "@/lib/schedule";
import type { Frequency, MilkPrice, MilkType, PaymentMethod, Product, QualityRating } from "../types";
import {
  DB_VERSION,
  gatewayId,
  uid,
  type DbGatewayPayment,
  type DbSlot,
  type DbSubscriptionSkip,
  type DbContribution,
  type DbFarmer,
  type DbOrder,
  type DbOrderItem,
  type DbPayment,
  type DbProfile,
  type DbSubscription,
  type DbWalletTxn,
  type DemoDb,
} from "./db";

/* --------------------------------------------------------------- helpers */

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Coordinates are authored relative to Kochi and shifted to MAP_CENTER, so a
// different VITE_MAP_CENTER moves the whole demo city.
const KOCHI: [number, number] = [9.9816, 76.2999];
const shift = (lat: number, lng: number) => ({
  lat: round6(lat - KOCHI[0] + MAP_CENTER[0]),
  lng: round6(lng - KOCHI[1] + MAP_CENTER[1]),
});
function round6(n: number) {
  return Math.round(n * 1e6) / 1e6;
}

const otp = (rnd: () => number) => String(1000 + Math.floor(rnd() * 9000));

/* ------------------------------------------------------------------ data */

const CUSTOMERS = [
  ["u_priya", "Priya", "Raman", "priya@milkyway.demo", "14/220 Panampilly Avenue, Panampilly Nagar", 9.958, 76.2952],
  ["u_c2", "Anand", "Krishnan", "anand@milkyway.demo", "Edappally Toll Junction, Edappally", 10.0261, 76.3086],
  ["u_c3", "Meera", "Joseph", "meera@milkyway.demo", "Infopark Phase 1 Road, Kakkanad", 10.0159, 76.3419],
  ["u_c4", "Rahim", "Ali", "rahim@milkyway.demo", "Vyttila Hub Road, Vyttila", 9.9672, 76.3197],
  ["u_c5", "Sneha", "Pillai", "sneha@milkyway.demo", "Civil Line Road, Palarivattom", 10.005, 76.307],
  ["u_c6", "George", "Mathew", "george@milkyway.demo", "Kadavanthra Junction, Kadavanthra", 9.9666, 76.299],
  ["u_c7", "Divya", "Suresh", "divya@milkyway.demo", "Shanmugham Road, Marine Drive", 9.9785, 76.2765],
  ["u_c8", "Thomas", "Varghese", "thomas@milkyway.demo", "Thrikkakara Temple Road, Thrikkakara", 10.0335, 76.329],
  ["u_c9", "Aisha", "Kareem", "aisha@milkyway.demo", "Elamakkara Main Road, Elamakkara", 10.018, 76.293],
  ["u_c10", "Vinod", "Kumar", "vinod@milkyway.demo", "Thammanam–Pulleppady Road, Thammanam", 9.983, 76.325],
  ["u_c11", "Neha", "Menon", "neha@milkyway.demo", "Chalikkavattom Junction, Vennala", 9.98, 76.33],
  ["u_c12", "Sajan", "Paul", "sajan@milkyway.demo", "Stadium Link Road, Kaloor", 9.997, 76.293],
] as const;

const RIDERS = [
  ["u_arjun", "Arjun", "Krishna", "arjun@milkyway.demo", "+91 98470 11111"],
  ["u_vishnu", "Vishnu", "Sasi", "vishnu@milkyway.demo", "+91 98470 22222"],
  ["u_rahul", "Rahul", "Mohan", "rahul@milkyway.demo", "+91 98470 33333"],
] as const;

type FarmerSeed = {
  id: string;
  first: string;
  last: string;
  email: string;
  farm: string;
  place: string;
  lat: number;
  lng: number;
  milk: MilkType[];
  capacity: number;
  status: "approved" | "pending" | "rejected";
};

const FARMERS: FarmerSeed[] = [
  { id: "u_rajan", first: "Rajan", last: "Pillai", email: "rajan@milkyway.demo", farm: "Aluva Dairy Farm", place: "Aluva", lat: 10.1076, lng: 76.3516, milk: ["cow"], capacity: 60, status: "approved" },
  { id: "u_suma", first: "Suma", last: "Varghese", email: "suma@milkyway.demo", farm: "Green Pastures", place: "Angamaly", lat: 10.196, lng: 76.386, milk: ["cow"], capacity: 50, status: "approved" },
  { id: "u_joseph", first: "Joseph", last: "Kurian", email: "joseph@milkyway.demo", farm: "Periyar Valley Farm", place: "Perumbavoor", lat: 10.1155, lng: 76.479, milk: ["cow", "buffalo"], capacity: 70, status: "approved" },
  { id: "u_fathima", first: "Fathima", last: "Beevi", email: "fathima@milkyway.demo", farm: "Sunrise Goat Farm", place: "Kolenchery", lat: 9.9816, lng: 76.476, milk: ["goat"], capacity: 25, status: "approved" },
  { id: "u_mohan", first: "Mohan", last: "Das", email: "mohan@milkyway.demo", farm: "Kuttanad Buffalo Co.", place: "Piravom", lat: 9.873, lng: 76.492, milk: ["buffalo"], capacity: 45, status: "approved" },
  { id: "u_lakshmi", first: "Lakshmi", last: "Nair", email: "lakshmi@milkyway.demo", farm: "Lakshmi Gaushala", place: "Muvattupuzha", lat: 9.9894, lng: 76.579, milk: ["cow"], capacity: 30, status: "pending" },
  { id: "u_biju", first: "Biju", last: "Thomas", email: "biju@milkyway.demo", farm: "Hillside Dairy", place: "Thodupuzha", lat: 9.8959, lng: 76.7184, milk: ["cow"], capacity: 40, status: "rejected" },
];

const PRODUCTS: Product[] = [
  { id: "p_cow", name: "Fresh Cow Milk", milk_type: "cow", price: 60, unit: "liter", is_active: true },
  { id: "p_buffalo", name: "Creamy Buffalo Milk", milk_type: "buffalo", price: 80, unit: "liter", is_active: true },
  { id: "p_goat", name: "Goat Milk", milk_type: "goat", price: 120, unit: "liter", is_active: true },
];

/* ------------------------------------------------------------------ seed */

export function buildSeed(now: Date = new Date()): DemoDb {
  const rnd = mulberry32(20250801);
  const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)]!;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayISO = (d: number) => toLocalISODate(addDays(today, -d));
  const at = (d: number, h: number, m = 0) => {
    const t = addDays(today, -d);
    t.setHours(h, m, int(0, 59), 0);
    return t.toISOString();
  };
  const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();

  const depotPos = shift(9.9971, 76.2996);
  const depot = { id: "depot_kaloor", name: "MilkyWay Hub", address: "Kaloor, Kochi", ...depotPos };

  /* ---- profiles */
  const profiles: DbProfile[] = [];
  const base = { status: "approved" as const, latitude: null, longitude: null };
  profiles.push({
    ...base,
    id: "u_admin",
    email: "admin@milkyway.demo",
    user_type: "admin",
    first_name: "Anitha",
    last_name: "Menon",
    phone: "+91 98470 00000",
    address: "MilkyWay Hub, Kaloor",
    created_at: at(120, 9),
  });
  CUSTOMERS.forEach(([id, first, last, email, address, lat, lng], i) => {
    const pos = shift(lat, lng);
    profiles.push({
      id,
      email,
      user_type: "customer",
      status: "approved",
      first_name: first,
      last_name: last,
      phone: `+91 9${String(846000000 + i * 1371).padStart(9, "0")}`,
      address,
      latitude: pos.lat,
      longitude: pos.lng,
      created_at: at(90 - i * 6, 10 + (i % 8)),
    });
  });
  RIDERS.forEach(([id, first, last, email, phone], i) => {
    profiles.push({
      ...base,
      id,
      email,
      user_type: "delivery",
      first_name: first,
      last_name: last,
      phone,
      address: "Kochi",
      license_number: `KL07 2021000${i + 1}`,
      created_at: at(100 - i * 10, 11),
    });
  });
  const farmers: DbFarmer[] = [];
  FARMERS.forEach((f, i) => {
    const pos = shift(f.lat, f.lng);
    profiles.push({
      id: f.id,
      email: f.email,
      user_type: "farmer",
      status: f.status,
      first_name: f.first,
      last_name: f.last,
      phone: `+91 94470 ${String(10000 + i * 1111).slice(0, 5)}`,
      address: f.place,
      latitude: pos.lat,
      longitude: pos.lng,
      created_at: f.status === "pending" ? at(1, 16) : at(110 - i * 7, 9),
    });
    farmers.push({
      id: f.id,
      farmer_code: 1001 + i,
      farm_name: f.farm,
      farm_location: `${f.place}, Ernakulam`,
      production_capacity: f.capacity,
    });
  });

  /* ---- pricing (history preserved: a price change 20 days ago) */
  const pricing: MilkPrice[] = [
    { id: uid("mp"), milk_type: "cow", price_per_liter: 42, effective_from: dayISO(60) },
    { id: uid("mp"), milk_type: "buffalo", price_per_liter: 56, effective_from: dayISO(60) },
    { id: uid("mp"), milk_type: "goat", price_per_liter: 90, effective_from: dayISO(60) },
    { id: uid("mp"), milk_type: "cow", price_per_liter: 45, effective_from: dayISO(20) },
    { id: uid("mp"), milk_type: "buffalo", price_per_liter: 60, effective_from: dayISO(20) },
  ];
  const priceOn = (milk: MilkType, date: string) =>
    pricing
      .filter((p) => p.milk_type === milk && p.effective_from <= date)
      .sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0]?.price_per_liter ?? 0;

  /* ---- contributions + farmer payments */
  const contributions: DbContribution[] = [];
  const payments: DbPayment[] = [];
  const wallet: DbWalletTxn[] = [];
  const collectors = ["u_arjun", "u_rahul", "u_vishnu"];

  FARMERS.forEach((f) => {
    if (f.status === "pending") return;
    const days = f.status === "rejected" ? [16, 14, 12, 10, 9, 8] : Array.from({ length: 30 }, (_, i) => 29 - i);
    days.forEach((d, idx) => {
      if (d === 0 && now.getHours() < 7) return; // morning collection hasn't happened yet
      let rating: QualityRating = rnd() < 0.72 ? 1 : 2;
      if (f.status === "rejected" && idx >= days.length - 3) rating = 3;
      else if (f.status === "approved" && rnd() < 0.03) rating = 3;
      const milk = pick(f.milk);
      const qty = rating === 3 ? 0 : round2(f.capacity * (0.65 + rnd() * 0.35));
      contributions.push({
        id: uid("mc"),
        farmer_id: f.id,
        quantity: qty,
        milk_type: milk,
        quality_rating: rating,
        contribution_date: dayISO(d),
        payment_id: null,
        collected_by: pick(collectors),
        created_at: at(d, 6, int(0, 50)),
      });
    });
    if (f.status !== "approved") return;

    // Pay out in weekly batches; the last batch is pending for two farmers.
    const batches: [number, number, "approved" | "pending"][] = [
      [29, 22, "approved"],
      [21, 15, "approved"],
      [14, 8, f.id === "u_rajan" || f.id === "u_suma" ? "pending" : "approved"],
    ];
    for (const [from, to, status] of batches) {
      const rows = contributions.filter(
        (c) => c.farmer_id === f.id && c.contribution_date >= dayISO(from) && c.contribution_date <= dayISO(to)
      );
      const amount = round2(rows.reduce((s, c) => s + c.quantity * priceOn(c.milk_type, c.contribution_date), 0));
      if (amount <= 0) continue;
      const requested = at(to - 1, 18, int(0, 59));
      const payment: DbPayment = {
        id: uid("fp"),
        farmer_id: f.id,
        amount,
        status,
        payment_date: dayISO(to - 1),
        approved_by: status === "approved" ? "u_admin" : null,
        approved_at: status === "approved" ? at(to - 2, 11) : null,
        created_at: requested,
      };
      payments.push(payment);
      rows.forEach((c) => (c.payment_id = payment.id));
      if (status === "approved") {
        wallet.push({
          id: uid("wt"),
          user_id: f.id,
          amount,
          transaction_type: "deposit",
          status: "completed",
          description: "Milk contribution payment",
          order_id: null,
          created_at: payment.approved_at!,
        });
      }
    }
  });

  /* ---- subscriptions */
  const subscriptions: DbSubscription[] = [];
  const subSeeds: [string, string, number, Frequency, "active" | "paused"][] = [
    ["u_priya", "p_cow", 1, "daily", "active"],
    ["u_c2", "p_cow", 2, "daily", "active"],
    ["u_c3", "p_buffalo", 1, "daily", "active"],
    ["u_c5", "p_goat", 2, "weekly", "active"],
    ["u_c6", "p_cow", 1, "daily", "active"],
    ["u_c8", "p_buffalo", 7, "weekly", "active"],
    ["u_c9", "p_cow", 15, "monthly", "active"],
    ["u_c11", "p_cow", 1, "daily", "paused"],
  ];
  const preferred: Record<string, string> = { u_priya: "06:00", u_c2: "06:00", u_c3: "08:00", u_c6: "17:00" };
  subSeeds.forEach(([customer, product, quantity, frequency, status], i) => {
    const p = PRODUCTS.find((x) => x.id === product)!;
    subscriptions.push({
      preferred_slot_start: preferred[customer] ?? null,
      id: uid("sub"),
      customer_id: customer,
      product_id: product,
      milk_type: p.milk_type,
      quantity,
      frequency,
      status,
      next_delivery: addDays(today, 1).toISOString(),
      created_at: at(40 - i * 3, 20),
    });
  });
  // Priya skips one day this week; George (u_c6) is on vacation for five days
  const subscriptionSkips: DbSubscriptionSkip[] = [];
  const subOf = (c: string) => subscriptions.find((x) => x.customer_id === c)!;
  subscriptionSkips.push({ subscription_id: subOf("u_priya").id, skip_date: dayISO(-3) });
  for (let d = 1; d <= 5; d++) subscriptionSkips.push({ subscription_id: subOf("u_c6").id, skip_date: dayISO(-d) });

  /* ---- delivery slots: today + 6 days from the default windows */
  const slots: DbSlot[] = [];
  for (let d = 0; d <= 6; d++) {
    for (const w of DEFAULT_WINDOWS) {
      slots.push({ id: uid("slot"), slot_date: dayISO(-d), start_time: w.start, end_time: w.end, capacity: DEFAULT_SLOT_CAPACITY, is_active: true });
    }
  }
  const slotAt = (daysAhead: number, start: string) => slots.find((x) => x.slot_date === dayISO(-daysAhead) && x.start_time === start)!;

  const demand = subscriptions
    .filter((s) => s.status === "active")
    .reduce((s, x) => s + (x.frequency === "daily" ? x.quantity : x.frequency === "weekly" ? x.quantity / 7 : x.quantity / 30), 0);

  /* ---- orders */
  const orders: DbOrder[] = [];
  const orderItems: DbOrderItem[] = [];
  const customerPos = new Map(CUSTOMERS.map(([id, , , , address, lat, lng]) => [id, { address, ...shift(lat, lng) }]));
  const riderIds = RIDERS.map((r) => r[0]);

  const addOrder = (o: {
    customer: string;
    product?: Product;
    qty?: number;
    method?: PaymentMethod;
    status: DbOrder["status"];
    rider?: string | null;
    created: string;
    assigned?: string | null;
    picked?: string | null;
    delivered?: string | null;
    source?: "order" | "subscription";
    slot?: DbSlot | null;
  }) => {
    const product = o.product ?? (rnd() < 0.6 ? PRODUCTS[0]! : rnd() < 0.6 ? PRODUCTS[1]! : PRODUCTS[2]!);
    const qty = o.qty ?? pick([1, 1, 1.5, 2, 2, 3]);
    const pos = customerPos.get(o.customer as (typeof CUSTOMERS)[number][0])!;
    const order: DbOrder = {
      id: uid("ord"),
      customer_id: o.customer,
      total_amount: round2(product.price * qty),
      status: o.status,
      payment_method: o.method ?? (rnd() < 0.68 ? "wallet" : rnd() < 0.55 ? "online" : "cash"),
      delivery_person_id: o.rider ?? null,
      delivery_address: pos.address,
      delivery_lat: pos.lat,
      delivery_lng: pos.lng,
      delivery_notes: rnd() < 0.15 ? pick(["Leave at the gate", "Call on arrival", "Ring the bell twice"]) : null,
      delivery_otp: otp(rnd),
      assigned_at: o.assigned ?? null,
      picked_up_at: o.picked ?? null,
      delivered_at: o.delivered ?? null,
      created_at: o.created,
      source: o.source ?? "order",
      delivery_slot_id: o.slot?.id ?? null,
    };
    orders.push(order);
    orderItems.push({ id: uid("oi"), order_id: order.id, product_id: product.id, quantity: qty, unit_price: product.price });
    return order;
  };

  // history: last 29 days
  for (let d = 29; d >= 1; d--) {
    const n = int(7, 12);
    for (let i = 0; i < n; i++) {
      const customer = i === 0 && d % 3 === 0 ? "u_priya" : pick(CUSTOMERS)[0];
      const rider = pick(riderIds);
      const h = int(5, 8);
      const m = int(0, 59);
      const cancelled = rnd() < 0.05;
      addOrder({
        customer,
        status: cancelled ? "cancelled" : "completed",
        rider: cancelled ? null : rider,
        created: at(d, h, m),
        assigned: cancelled ? null : at(d, h, Math.min(59, m + 5)),
        picked: cancelled ? null : at(d, h + 1, int(0, 20)),
        delivered: cancelled ? null : at(d, h + 1, int(25, 59)),
        source: rnd() < 0.3 ? "subscription" : "order",
      });
    }
  }

  // today: a live operating picture
  for (let i = 0; i < 5; i++) {
    const created = ago(int(150, 230));
    addOrder({
      customer: pick(CUSTOMERS.slice(1))[0],
      status: "completed",
      rider: i % 2 ? "u_rahul" : "u_arjun",
      created,
      assigned: ago(140),
      picked: ago(int(110, 130)),
      delivered: ago(int(60, 100)),
    });
  }
  // Vishnu is on the road with Priya's order (tracking demo) and one more
  addOrder({ customer: "u_priya", product: PRODUCTS[0], qty: 2, method: "wallet", status: "out_for_delivery", rider: "u_vishnu", created: ago(38), assigned: ago(30), picked: ago(9) });
  addOrder({ customer: "u_c6", status: "out_for_delivery", rider: "u_vishnu", created: ago(45), assigned: ago(30), picked: ago(9) });
  // Arjun (the demo rider) has assigned stops waiting to start
  for (const c of ["u_c2", "u_c5", "u_c3"]) {
    addOrder({ customer: c, status: "pending", rider: "u_arjun", created: ago(int(20, 35)), assigned: ago(15) });
  }
  // unassigned orders for the dispatch board
  for (const c of ["u_c4", "u_c10", "u_c9"]) {
    addOrder({ customer: c, status: "pending", rider: null, created: ago(int(3, 14)) });
  }

  // scheduled orders for tomorrow's windows (dispatched ~90 min before each slot)
  addOrder({ customer: "u_priya", product: PRODUCTS[1], qty: 1, method: "online", status: "pending", created: ago(70), slot: slotAt(1, "06:00") });
  for (const c of ["u_c7", "u_c8", "u_c11", "u_c12", "u_c4"]) {
    addOrder({ customer: c, status: "pending", created: ago(int(60, 600)), slot: slotAt(1, pick(["06:00", "06:00", "08:00"])) });
  }
  for (const c of ["u_c10", "u_c3"]) {
    addOrder({ customer: c, status: "pending", created: ago(int(30, 300)), slot: slotAt(1, "17:00") });
  }

  /* ---- online payments (simulated Razorpay) for orders paid by UPI/card */
  const gatewayPayments: DbGatewayPayment[] = [];
  const UPI_HANDLES = ["okhdfc", "okicici", "oksbi", "ybl", "paytm"];
  const methodFor = (customer: string): Pick<DbGatewayPayment, "method" | "method_detail"> =>
    rnd() < 0.7
      ? { method: "upi", method_detail: `UPI · ${customer.replace("u_", "")}@${pick(UPI_HANDLES)}` }
      : { method: "card", method_detail: `Visa •••• ${pick(["1111", "4242", "0019"])}` };
  for (const o of orders.filter((x) => x.payment_method === "online")) {
    const m = methodFor(o.customer_id);
    const payId = gatewayId("pay");
    gatewayPayments.push({
      gateway_order_id: gatewayId("order"),
      id: payId,
      user_id: o.customer_id,
      amount: o.total_amount,
      purpose: "order",
      ...m,
      status: o.status === "cancelled" ? "refunded" : "captured",
      failure_reason: null,
      order_id: o.id,
      created_at: o.created_at,
      captured_at: o.created_at,
      refunded_at: o.status === "cancelled" ? new Date(new Date(o.created_at).getTime() + 20 * 60_000).toISOString() : null,
    });
    o.gateway_payment_id = payId;
  }

  /* ---- customer wallets: recharges cover spend, plus refunds */
  for (const [customer] of CUSTOMERS) {
    const mine = orders.filter((o) => o.customer_id === customer && o.payment_method === "wallet");
    const spent = mine.reduce((s, o) => s + o.total_amount, 0);
    const topUp = Math.ceil((spent + 500 + rnd() * 1500) / 500) * 500;
    // top-ups went through the (simulated) payment gateway: UPI, a declined card, then a good card
    const first = Math.ceil((topUp * 0.6) / 100) * 100;
    const handle = pick(UPI_HANDLES);
    const topUps: [number, string, DbGatewayPayment["method"], string, boolean][] = [
      [first, at(30, 20), "upi", `UPI · ${customer.replace("u_", "")}@${handle}`, true],
      [topUp - first, at(14, 20), "card", "Visa •••• 0002", false],
      [topUp - first, at(14, 21), "card", "Visa •••• 1111", true],
    ];
    for (const [amount, when, method, detail, ok] of topUps) {
      const payId = gatewayId("pay");
      gatewayPayments.push({
        gateway_order_id: gatewayId("order"),
        id: payId,
        user_id: customer,
        amount,
        purpose: "wallet_topup",
        method,
        method_detail: detail,
        status: ok ? "captured" : "failed",
        failure_reason: ok ? null : "Card declined by issuing bank",
        order_id: null,
        created_at: when,
        captured_at: ok ? when : null,
        refunded_at: null,
      });
      if (ok) {
        wallet.push({ id: uid("wt"), user_id: customer, amount, transaction_type: "deposit", status: "completed", description: `Wallet top-up · ${method === "upi" ? "UPI" : "Card"} (${payId})`, order_id: null, created_at: when });
      }
    }
    for (const o of mine) {
      wallet.push({ id: uid("wt"), user_id: customer, amount: o.total_amount, transaction_type: "withdrawal", status: "completed", description: "Order payment", order_id: o.id, created_at: o.created_at });
      if (o.status === "cancelled") {
        wallet.push({ id: uid("wt"), user_id: customer, amount: o.total_amount, transaction_type: "deposit", status: "completed", description: "Refund for cancelled order", order_id: o.id, created_at: new Date(new Date(o.created_at).getTime() + 20 * 60_000).toISOString() });
      }
    }
  }

  /* ---- stock + archive */
  const archive = [];
  let leftover = 18;
  const soldOn = (date: string) =>
    orders
      .filter((o) => o.status !== "cancelled" && toLocalISODate(new Date(o.created_at)) === date)
      .reduce((s, o) => s + orderItems.filter((i) => i.order_id === o.id).reduce((q, i) => q + i.quantity, 0), 0);
  const collectedOn = (date: string) =>
    contributions.filter((c) => c.contribution_date === date).reduce((s, c) => s + c.quantity, 0);
  for (let d = 29; d >= 1; d--) {
    const date = dayISO(d);
    // most milk goes to bulk buyers at the end of the day; a little carries over
    const endStock = Math.max(0, round2(collectedOn(date) + leftover - soldOn(date)));
    const carried = round2(Math.min(endStock, 12 + rnd() * 20));
    archive.push({ id: uid("ar"), date, total_stock: endStock, subscription_demand: round2(demand), leftover_stock: carried });
    leftover = carried;
  }
  const todayStock = Math.max(0, round2(collectedOn(dayISO(0)) + leftover - soldOn(dayISO(0))));
  const stock = [{ date: dayISO(0), total_stock: todayStock }];
  const reservations = [
    { id: uid("sr"), reservation_date: dayISO(0), reserved_amount: Math.ceil(demand), reservation_type: "subscription" as const },
    { id: uid("sr"), reservation_date: dayISO(-1), reserved_amount: Math.ceil(demand), reservation_type: "subscription" as const },
  ];

  /* ---- rider positions */
  const vishnuStart = { lat: (depotPos.lat * 2 + customerPos.get("u_priya")!.lat) / 3, lng: (depotPos.lng * 2 + customerPos.get("u_priya")!.lng) / 3 };
  const riderLocations = [
    { rider_id: "u_arjun", ...depotPos, heading: 0, speed: 0, updated_at: ago(1) },
    { rider_id: "u_vishnu", ...vishnuStart, heading: 180, speed: 6, updated_at: ago(0) },
    { rider_id: "u_rahul", ...shift(9.9705, 76.3175), heading: 90, speed: 0, updated_at: ago(4) },
  ];

  const notifications = [
    { id: uid("n"), audience: "admin", title: "Payment requests waiting", body: "Rajan Pillai and Suma Varghese requested payment.", kind: "payment" as const, link: "/dashboard/admin/payments", created_at: ago(60 * 20) },
    { id: uid("n"), audience: "admin", title: "New farmer registration", body: "Lakshmi Nair (Lakshmi Gaushala) is awaiting approval.", kind: "system" as const, link: "/dashboard/admin/farmers", created_at: ago(60 * 22) },
    { id: uid("n"), audience: "admin", title: "3 orders need a rider", body: "Assign them from Live Ops or use auto-assign.", kind: "delivery" as const, link: "/dashboard/admin/live", created_at: ago(5) },
    { id: uid("n"), audience: "u_priya", title: "Your milk is on the way", body: "Vishnu picked up your order and is heading to you.", kind: "delivery" as const, link: "/dashboard/customer/orders", created_at: ago(9) },
    { id: uid("n"), audience: "u_rajan", title: "Payment approved", body: "Your weekly milk payment was credited to your wallet.", kind: "payment" as const, link: "/dashboard/farmer/payments", created_at: ago(60 * 24 * 8) },
    { id: uid("n"), audience: "u_arjun", title: "3 new stops assigned", body: "Edappally, Palarivattom and Kakkanad. Start your trip when ready.", kind: "delivery" as const, link: "/dashboard/delivery", created_at: ago(15) },
  ];

  return {
    version: DB_VERSION,
    seededOn: dayISO(0),
    depot,
    profiles,
    farmers,
    products: PRODUCTS.map((p) => ({ ...p })),
    pricing,
    orders,
    orderItems,
    wallet,
    payments,
    contributions,
    stock,
    archive,
    reservations,
    subscriptions,
    subscriptionSkips,
    slots,
    gatewayPayments,
    riderLocations,
    notifications,
    nextFarmerCode: 1001 + FARMERS.length,
    autoDispatch: true,
  };
}
