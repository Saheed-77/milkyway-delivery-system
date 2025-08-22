/**
 * Demo delivery simulator. Moves riders along real road geometry (OSRM, with
 * a straight-line fallback) so live tracking, Live Ops and the rider route
 * all animate without a backend.
 *
 * - "Bot" riders (everyone except the demo rider account) pick up assigned
 *   orders, drive to each stop, hand over and complete it.
 * - The demo rider (a person clicking through the app) only moves while
 *   self-drive is on, and completes stops with the customer's OTP.
 * - Unassigned orders are auto-dispatched to bot riders after a short delay.
 *
 * Only one tab runs the simulation (localStorage heartbeat leader election);
 * other tabs follow via storage events.
 */
import { round2 } from "@/lib/format";
import { haversine, pointAlong, type LatLng } from "@/lib/geo";
import { getRoute, optimizeStops } from "@/lib/routing";
import { DEMO_ACCOUNTS, uid, type DbOrder } from "./db";
import { autoAssignOrders } from "./mockApi";
import { getStore } from "./store";

const TICK_MS = 1000;
const SPEED_MPS = 14; // a little faster than real life so the demo stays lively
const HANDOVER_MS = 10_000;
const DISPATCH_AFTER_MS = 30_000;
const BOT_START_AFTER_MS = 15_000;
const ARRIVED_METERS = 40;
const PERSIST_EVERY = 2;
const LEADER_KEY = "milkyway.demo.sim";

interface Leg {
  orderId: string;
  path: LatLng[];
  traveled: number;
}

const tabId = uid("tab");
const legs = new Map<string, Leg | "loading">();
const arrivedAt = new Map<string, number>();
let timer: ReturnType<typeof setInterval> | null = null;
let ticks = 0;
const startedAt = Date.now();

function isLeader(): boolean {
  try {
    const raw = localStorage.getItem(LEADER_KEY);
    const now = Date.now();
    const current = raw ? (JSON.parse(raw) as { id: string; ts: number }) : null;
    if (!current || current.id === tabId || now - current.ts > 3500) {
      localStorage.setItem(LEADER_KEY, JSON.stringify({ id: tabId, ts: now }));
      return true;
    }
    return false;
  } catch {
    return true; // no storage: this tab is the only one that can run it
  }
}

const humanRiderId = () => getStore().db.profiles.find((p) => p.email === DEMO_ACCOUNTS.delivery)?.id;

function riderPos(riderId: string): LatLng {
  const db = getStore().db;
  return db.riderLocations.find((l) => l.rider_id === riderId) ?? db.depot;
}

function setRiderPos(riderId: string, point: LatLng, heading: number, speed: number) {
  const db = getStore().db;
  const next = { rider_id: riderId, lat: point.lat, lng: point.lng, heading, speed, updated_at: new Date().toISOString() };
  const existing = db.riderLocations.find((l) => l.rider_id === riderId);
  if (existing) Object.assign(existing, next);
  else db.riderLocations.push(next);
}

function completeOrder(o: DbOrder) {
  const store = getStore();
  o.status = "completed";
  o.delivered_at = new Date().toISOString();
  store.db.notifications.unshift({
    id: uid("n"),
    audience: o.customer_id,
    title: "Order delivered",
    body: "Your milk has been delivered. Enjoy!",
    kind: "delivery",
    link: "/dashboard/customer/orders",
    created_at: new Date().toISOString(),
  });
}

function nextStop(riderId: string, active: DbOrder[]): DbOrder | undefined {
  const withPos = active
    .filter((o) => o.delivery_lat != null && o.delivery_lng != null)
    .map((o) => ({ o, lat: o.delivery_lat!, lng: o.delivery_lng! }));
  return optimizeStops(riderPos(riderId), withPos)[0]?.o;
}

function tick() {
  if (!isLeader()) return;
  const store = getStore();
  const db = store.db;
  const now = Date.now();
  const human = humanRiderId();
  let ordersChanged = false;
  let moved = false;

  // 1. auto-dispatch to bot riders
  if (db.autoDispatch) {
    const stale = db.orders.some(
      (o) =>
        o.status === "pending" &&
        !o.delivery_person_id &&
        now - Math.max(startedAt, new Date(o.created_at).getTime()) > DISPATCH_AFTER_MS
    );
    // keep the demo rider's queue for the person driving the demo
    if (stale && autoAssignOrders(6, human ? [human] : []) > 0) ordersChanged = true;
  }

  const riders = db.profiles.filter((p) => p.user_type === "delivery");
  for (const rider of riders) {
    const isHuman = rider.id === human;
    const selfDrive = !!db.selfDrive?.[rider.id];

    // 2. bots start their assigned orders after a short "loading" pause
    if (!isHuman && db.autoDispatch) {
      for (const o of db.orders) {
        if (
          o.delivery_person_id === rider.id &&
          o.status === "pending" &&
          o.assigned_at &&
          now - Math.max(startedAt, new Date(o.assigned_at).getTime()) > BOT_START_AFTER_MS
        ) {
          o.status = "out_for_delivery";
          o.picked_up_at = new Date().toISOString();
          db.notifications.unshift({
            id: uid("n"),
            audience: o.customer_id,
            title: "Your milk is on the way",
            body: `${rider.first_name ?? "Your rider"} picked up your order. Track it live.`,
            kind: "delivery",
            link: `/dashboard/customer/track/${o.id}`,
            created_at: new Date().toISOString(),
          });
          ordersChanged = true;
        }
      }
    }

    if (isHuman && !selfDrive) continue;
    if (!isHuman && !db.autoDispatch) continue;

    const active = db.orders.filter((o) => o.delivery_person_id === rider.id && o.status === "out_for_delivery");
    if (!active.length) {
      legs.delete(rider.id);
      continue;
    }

    let leg = legs.get(rider.id);
    const legOrderId = leg && leg !== "loading" ? leg.orderId : null;
    if (legOrderId && !active.some((o) => o.id === legOrderId)) {
      legs.delete(rider.id);
      leg = undefined;
    }
    if (!leg) {
      const target = nextStop(rider.id, active);
      if (!target) continue;
      legs.set(rider.id, "loading");
      const from = riderPos(rider.id);
      getRoute([from, { lat: target.delivery_lat!, lng: target.delivery_lng! }]).then((r) => {
        legs.set(rider.id, { orderId: target.id, path: r.path.length > 1 ? r.path : [from, { lat: target.delivery_lat!, lng: target.delivery_lng! }], traveled: 0 });
      });
      continue;
    }
    if (leg === "loading") continue;
    const current = leg;

    const order = active.find((o) => o.id === current.orderId);
    if (!order) continue;
    const dest = { lat: order.delivery_lat!, lng: order.delivery_lng! };
    const arrived = haversine(riderPos(rider.id), dest) < ARRIVED_METERS;

    if (arrived) {
      const here = db.riderLocations.find((l) => l.rider_id === rider.id);
      if (here) here.speed = 0;
      if (isHuman) continue; // the person completes with the OTP
      const since = arrivedAt.get(order.id) ?? now;
      arrivedAt.set(order.id, since);
      if (now - since > HANDOVER_MS) {
        completeOrder(order);
        arrivedAt.delete(order.id);
        legs.delete(rider.id);
        ordersChanged = true;
      }
      moved = true;
      continue;
    }

    current.traveled += SPEED_MPS * (TICK_MS / 1000) * (0.85 + Math.random() * 0.3);
    const { point, heading, done } = pointAlong(current.path, current.traveled);
    setRiderPos(rider.id, done ? dest : point, Math.round(heading), round2(SPEED_MPS));
    moved = true;
  }

  ticks++;
  if (ordersChanged) {
    store.commit("orders", "rider_locations");
  } else if (moved) {
    if (ticks % PERSIST_EVERY === 0) store.commit("rider_locations");
    else store.emit("rider_locations");
  }
}

export function startSimulator(): void {
  if (timer || typeof window === "undefined") return;
  timer = setInterval(() => {
    try {
      tick();
    } catch (e) {
      console.warn("[demo simulator]", e);
    }
  }, TICK_MS);
}

export function stopSimulator(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

/** Demo rider: simulate driving along the route (no real GPS on a desktop). */
export function setSelfDrive(riderId: string, on: boolean): void {
  const store = getStore();
  store.db.selfDrive = { ...(store.db.selfDrive ?? {}), [riderId]: on };
  if (!on) legs.delete(riderId);
  store.commit("rider_locations");
}

export function isSelfDriving(riderId: string): boolean {
  return !!getStore().db.selfDrive?.[riderId];
}

export function setAutoDispatch(on: boolean): void {
  const store = getStore();
  store.db.autoDispatch = on;
  store.commit("orders");
}

export const isAutoDispatch = () => getStore().db.autoDispatch;
