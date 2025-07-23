import { OSRM_URL } from "@/config/env";
import { estimateSeconds, haversine, pathLength, ROAD_FACTOR, type LatLng } from "./geo";

export interface RouteResult {
  path: LatLng[];
  /** metres */
  distance: number;
  /** seconds */
  duration: number;
  /** Per-leg distance/duration between consecutive waypoints. */
  legs: { distance: number; duration: number }[];
  source: "osrm" | "estimate";
}

const cache = new Map<string, Promise<RouteResult>>();
const keyOf = (pts: LatLng[]) => pts.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join(";");

/** Straight-line fallback used when OSRM is unreachable (offline, rate-limited). */
export function estimateRoute(points: LatLng[]): RouteResult {
  const legs = points.slice(1).map((p, i) => {
    const d = haversine(points[i]!, p);
    return { distance: d * ROAD_FACTOR, duration: estimateSeconds(d) };
  });
  return {
    path: points,
    distance: legs.reduce((s, l) => s + l.distance, 0),
    duration: legs.reduce((s, l) => s + l.duration, 0),
    legs,
    source: "estimate",
  };
}

async function fetchOsrm(points: LatLng[], signal?: AbortSignal): Promise<RouteResult> {
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
  const url = `${OSRM_URL}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`OSRM ${res.status}`);
  const json = (await res.json()) as {
    code: string;
    routes?: {
      distance: number;
      duration: number;
      geometry: { coordinates: [number, number][] };
      legs: { distance: number; duration: number }[];
    }[];
  };
  const route = json.routes?.[0];
  if (json.code !== "Ok" || !route) throw new Error(`OSRM ${json.code}`);
  const path = route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
  return {
    path,
    distance: route.distance || pathLength(path),
    duration: route.duration,
    legs: route.legs.map((l) => ({ distance: l.distance, duration: l.duration })),
    source: "osrm",
  };
}

/**
 * Road route through the given waypoints (in order). Uses OSRM with a short
 * timeout and falls back to a straight-line estimate, so callers always get
 * something drawable. Results are memoised per waypoint set.
 */
export function getRoute(points: LatLng[], timeoutMs = 6000): Promise<RouteResult> {
  if (points.length < 2) return Promise.resolve(estimateRoute(points));
  const key = keyOf(points);
  const hit = cache.get(key);
  if (hit) return hit;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const promise = fetchOsrm(points, controller.signal)
    .catch(() => {
      cache.delete(key); // allow a later retry against OSRM
      return estimateRoute(points);
    })
    .finally(() => clearTimeout(timer));
  cache.set(key, promise);
  return promise;
}

/* ---------------------------------------------------------------------------
 * Stop ordering: nearest-neighbour construction + 2-opt improvement.
 * Uses haversine distances, which is plenty for a few dozen urban stops and
 * keeps optimisation instant and offline.
 * ------------------------------------------------------------------------- */

function tourLength(start: LatLng, stops: LatLng[]): number {
  let total = 0;
  let prev = start;
  for (const s of stops) {
    total += haversine(prev, s);
    prev = s;
  }
  return total;
}

export function optimizeStops<T extends LatLng>(start: LatLng, stops: T[]): T[] {
  if (stops.length <= 2) {
    return [...stops].sort((a, b) => haversine(start, a) - haversine(start, b));
  }

  // nearest neighbour
  const remaining = [...stops];
  const order: T[] = [];
  let current: LatLng = start;
  while (remaining.length) {
    let best = 0;
    let bestD = Infinity;
    remaining.forEach((s, i) => {
      const d = haversine(current, s);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    const [next] = remaining.splice(best, 1);
    order.push(next!);
    current = next!;
  }

  // 2-opt (open path: the route does not return to the depot)
  let improved = true;
  let guard = 0;
  while (improved && guard++ < 50) {
    improved = false;
    for (let i = 0; i < order.length - 1; i++) {
      for (let k = i + 1; k < order.length; k++) {
        const candidate = [...order.slice(0, i), ...order.slice(i, k + 1).reverse(), ...order.slice(k + 1)];
        if (tourLength(start, candidate) + 1e-6 < tourLength(start, order)) {
          order.splice(0, order.length, ...candidate);
          improved = true;
        }
      }
    }
  }
  return order;
}

/** Google Maps turn-by-turn link (opens the native app on phones). */
export const navigationUrl = (to: LatLng, from?: LatLng | null) =>
  `https://www.google.com/maps/dir/?api=1${
    from ? `&origin=${from.lat},${from.lng}` : ""
  }&destination=${to.lat},${to.lng}&travelmode=driving`;
