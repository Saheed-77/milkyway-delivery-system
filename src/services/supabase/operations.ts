import * as rpc from "@/lib/rpc";
import { addDays, fullName, round2, toLocalISODate } from "@/lib/format";
import type { DataApi } from "../api";
import type { AppNotification, Depot, Rider, RiderLocation, StockSummary, UserRole } from "../types";
import {
  CONTRIBUTION_SELECT,
  currentUserId,
  mapContribution,
  mapOrder,
  must,
  ORDER_SELECT,
  priceResolver,
  pricingHistory,
  sb,
} from "./shared";

const FALLBACK_DEPOT: Depot = { id: "default", name: "MilkyWay Hub", address: "Kochi", lat: 9.9971, lng: 76.2996 };
const dayStartIso = (date: string) => new Date(`${date}T00:00:00`).toISOString();

async function reservationOn(date: string): Promise<number> {
  const { data, error } = await sb().from("stock_reservations").select("reserved_amount").eq("reservation_date", date);
  if (error) return 0; // customers cannot read reservations
  return round2((data ?? []).reduce((s, r) => s + Number(r.reserved_amount), 0));
}

export const stock: DataApi["stock"] = {
  async today() {
    const today = toLocalISODate();
    const [summary, reservedToday, reservedTomorrow] = await Promise.all([
      rpc.getTodayStockSummary(),
      reservationOn(today),
      reservationOn(toLocalISODate(addDays(new Date(), 1))),
    ]);
    const total = Number(summary?.total_stock ?? 0);
    const result: StockSummary = {
      total_stock: round2(total),
      // The RPC subtracts average subscription demand; ordering is limited by
      // today's actual reservation, so report that instead.
      available_stock: round2(Math.max(0, total - reservedToday)),
      subscription_demand: round2(Number(summary?.subscription_demand ?? 0)),
      leftover_from_yesterday: round2(Number(summary?.leftover_from_yesterday ?? 0)),
      sold_stock: round2(Number(summary?.sold_stock ?? 0)),
      reserved_today: reservedToday,
      reserved_tomorrow: reservedTomorrow,
      date: today,
    };
    return result;
  },
  async adjust(delta) {
    await rpc.updateMilkStockSafe(delta);
  },
  async reserveTomorrow() {
    await rpc.autoReserveSubscriptionStock();
    return reservationOn(toLocalISODate(addDays(new Date(), 1)));
  },
  archiveAndReset: () => rpc.archiveAndResetDailyStock(),
  async archive(range) {
    const rows = await rpc.getMilkInventoryArchive(range?.from, range?.to);
    return (rows ?? []).map((r) => ({
      id: r.id,
      date: r.date,
      total_stock: Number(r.total_stock),
      available_stock: Number(r.available_stock),
      subscription_demand: round2(Number(r.subscription_demand)),
      leftover_milk: round2(Number(r.leftover_milk)),
    }));
  },
  async summary(periodDays = 30) {
    const s = await rpc.getInventorySummary(periodDays);
    return s && s.total_days > 0 ? s : null;
  },
};

async function depot(): Promise<Depot> {
  const { data } = await sb().from("depots").select("id, name, address, lat, lng").eq("is_active", true).order("created_at").limit(1);
  const d = data?.[0];
  return d ? { ...d, lat: Number(d.lat), lng: Number(d.lng) } : FALLBACK_DEPOT;
}

export const delivery: DataApi["delivery"] = {
  depot,
  async myStops() {
    const uid = await currentUserId();
    const [assigned, available] = await Promise.all([
      sb()
        .from("orders")
        .select(ORDER_SELECT)
        .eq("delivery_person_id", uid)
        .in("status", ["pending", "out_for_delivery"])
        .order("created_at")
        .then(must),
      sb()
        .from("orders")
        .select(ORDER_SELECT)
        .is("delivery_person_id", null)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(50)
        .then(must),
    ]);
    return { assigned: assigned.map(mapOrder), available: available.map(mapOrder) };
  },
  async myCompleted(range) {
    const uid = await currentUserId();
    let q = sb()
      .from("orders")
      .select(ORDER_SELECT)
      .eq("delivery_person_id", uid)
      .eq("status", "completed")
      .order("delivered_at", { ascending: false })
      .limit(300);
    if (range?.from) q = q.gte("delivered_at", dayStartIso(range.from));
    if (range?.to) q = q.lt("delivered_at", dayStartIso(toLocalISODate(addDays(new Date(`${range.to}T00:00:00`), 1))));
    return must(await q).map(mapOrder);
  },
  async claim(orderId) {
    await rpc.claimOrder(orderId);
  },
  async start(orderId) {
    await rpc.startDelivery(orderId);
  },
  async complete(orderId, otp) {
    await rpc.completeDelivery(orderId, otp);
  },
  async updateLocation(loc) {
    await rpc.updateRiderLocation(loc);
  },
  async riders() {
    const today = toLocalISODate();
    const [profiles, locations, active, doneToday] = await Promise.all([
      sb().from("profiles").select("id, first_name, last_name, phone").eq("user_type", "delivery").then(must),
      sb().from("rider_locations").select("*").then(must),
      sb().from("orders").select("delivery_person_id").in("status", ["pending", "out_for_delivery"]).not("delivery_person_id", "is", null).then(must),
      sb().from("orders").select("delivery_person_id").eq("status", "completed").gte("delivered_at", dayStartIso(today)).then(must),
    ]);
    const count = (rows: { delivery_person_id: string | null }[], id: string) => rows.filter((r) => r.delivery_person_id === id).length;
    return profiles.map<Rider>((p) => ({
      id: p.id,
      name: fullName(p),
      phone: p.phone,
      location: (locations.find((l) => l.rider_id === p.id) as RiderLocation | undefined) ?? null,
      active_orders: count(active, p.id),
      completed_today: count(doneToday, p.id),
    }));
  },
  async assign(orderId, riderId) {
    await rpc.assignOrder(orderId, riderId);
  },
  autoAssign: () => rpc.autoAssignOrders(),
  async locations() {
    return must(await sb().from("rider_locations").select("*")) as RiderLocation[];
  },
};

export const reports: DataApi["reports"] = {
  async dataset(days) {
    const from = toLocalISODate(addDays(new Date(), -days + 1));
    const signupFrom = toLocalISODate(addDays(new Date(), -Math.max(days, 90)));
    const [orderRows, history, contribRows, signups] = await Promise.all([
      sb().from("orders").select(ORDER_SELECT).gte("created_at", dayStartIso(from)).limit(5000).then(must),
      pricingHistory(),
      sb().from("milk_contributions").select(CONTRIBUTION_SELECT).gte("contribution_date", from).limit(5000).then(must),
      sb().from("profiles").select("id, user_type, created_at").gte("created_at", dayStartIso(signupFrom)).then(must),
    ]);
    const priceOn = priceResolver(history);
    return {
      orders: orderRows.map(mapOrder),
      contributions: contribRows.map((r) => mapContribution(r, priceOn)),
      signups: signups.map((s) => ({ ...s, user_type: s.user_type as UserRole })),
    };
  },
};

/**
 * Live mode has no notifications table; derive a short activity feed from
 * recent records the signed-in user can see.
 */
export const notifications: DataApi["notifications"] = {
  async recent() {
    const uid = await currentUserId();
    const profile = must(await sb().from("profiles").select("user_type").eq("id", uid).single());
    const since = new Date(Date.now() - 3 * 86400_000).toISOString();
    const out: AppNotification[] = [];
    if (profile.user_type === "customer") {
      const rows = must(
        await sb().from("orders").select("id, status, created_at, picked_up_at, delivered_at").eq("customer_id", uid).gte("created_at", since)
      );
      for (const o of rows) {
        if (o.delivered_at) out.push({ id: `d-${o.id}`, title: "Order delivered", body: "Your milk has been delivered. Enjoy!", created_at: o.delivered_at, kind: "delivery", link: "/dashboard/customer/orders" });
        else if (o.status === "out_for_delivery") out.push({ id: `o-${o.id}`, title: "Your milk is on the way", body: "Track your rider live.", created_at: o.picked_up_at ?? o.created_at, kind: "delivery", link: `/dashboard/customer/track/${o.id}` });
      }
    } else if (profile.user_type === "farmer") {
      const rows = must(await sb().from("farmer_payments").select("id, status, amount, approved_at").eq("farmer_id", uid).not("approved_at", "is", null).gte("approved_at", since));
      for (const p of rows) {
        out.push({ id: `p-${p.id}`, title: p.status === "approved" ? "Payment approved" : "Payment rejected", body: p.status === "approved" ? `₹${Number(p.amount).toFixed(2)} was credited to your wallet.` : "Your contributions were released.", created_at: p.approved_at!, kind: "payment", link: "/dashboard/farmer/payments" });
      }
    } else if (profile.user_type === "admin") {
      const [pay, farm, unassigned] = await Promise.all([
        sb().from("farmer_payments").select("id", { count: "exact", head: true }).eq("status", "pending"),
        sb().from("profiles").select("id", { count: "exact", head: true }).eq("user_type", "farmer").eq("status", "pending"),
        sb().from("orders").select("id", { count: "exact", head: true }).eq("status", "pending").is("delivery_person_id", null),
      ]);
      const now = new Date().toISOString();
      if (pay.count) out.push({ id: "pay", title: "Payment requests waiting", body: `${pay.count} farmer payment(s) need review.`, created_at: now, kind: "payment", link: "/dashboard/admin/payments" });
      if (farm.count) out.push({ id: "farm", title: "Farmer registrations", body: `${farm.count} farmer(s) awaiting approval.`, created_at: now, kind: "system", link: "/dashboard/admin/farmers" });
      if (unassigned.count) out.push({ id: "unassigned", title: "Orders need a rider", body: `${unassigned.count} order(s) are unassigned.`, created_at: now, kind: "delivery", link: "/dashboard/admin/live" });
    } else if (profile.user_type === "delivery") {
      const rows = must(await sb().from("orders").select("id, assigned_at, delivery_address").eq("delivery_person_id", uid).eq("status", "pending").gte("assigned_at", since));
      for (const o of rows) out.push({ id: `a-${o.id}`, title: "New stop assigned", body: o.delivery_address ?? "A customer was added to your route.", created_at: o.assigned_at!, kind: "delivery", link: "/dashboard/delivery" });
    }
    return out.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 20);
  },
};
