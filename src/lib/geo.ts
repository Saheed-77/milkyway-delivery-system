export interface LatLng {
  lat: number;
  lng: number;
}

const R = 6371000; // earth radius, metres
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

/** Great-circle distance in metres. */
export function haversine(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing from a to b in degrees (0 = north, clockwise). */
export function bearing(a: LatLng, b: LatLng): number {
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export const lerp = (a: LatLng, b: LatLng, t: number): LatLng => ({
  lat: a.lat + (b.lat - a.lat) * t,
  lng: a.lng + (b.lng - a.lng) * t,
});

export function pathLength(path: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += haversine(path[i - 1]!, path[i]!);
  return total;
}

/**
 * Point at `distance` metres along a polyline, plus the heading of the
 * segment it lies on. Clamps to the end of the path.
 */
export function pointAlong(
  path: LatLng[],
  distance: number
): { point: LatLng; heading: number; done: boolean } {
  if (path.length === 0) return { point: { lat: 0, lng: 0 }, heading: 0, done: true };
  if (path.length === 1) return { point: path[0]!, heading: 0, done: true };
  let remaining = Math.max(0, distance);
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const seg = haversine(a, b);
    if (remaining <= seg) {
      const t = seg === 0 ? 1 : remaining / seg;
      return { point: lerp(a, b, t), heading: bearing(a, b), done: false };
    }
    remaining -= seg;
  }
  const last = path[path.length - 1]!;
  return { point: last, heading: bearing(path[path.length - 2]!, last), done: true };
}

/** Average urban delivery speed used for straight-line ETA fallbacks (~22 km/h). */
export const URBAN_SPEED_MPS = 22_000 / 3600;

/** Straight-line distances underestimate road distance; ~1.35 is typical for cities. */
export const ROAD_FACTOR = 1.35;

export const estimateSeconds = (meters: number) => (meters * ROAD_FACTOR) / URBAN_SPEED_MPS;

export function boundsOf(points: LatLng[]): [[number, number], [number, number]] | null {
  if (points.length === 0) return null;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const p of points) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  }
  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ];
}

export const isValidLatLng = (p: Partial<LatLng> | null | undefined): p is LatLng =>
  !!p &&
  typeof p.lat === "number" &&
  typeof p.lng === "number" &&
  Number.isFinite(p.lat) &&
  Number.isFinite(p.lng) &&
  Math.abs(p.lat) <= 90 &&
  Math.abs(p.lng) <= 180;
