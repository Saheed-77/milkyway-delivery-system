import { MAP_CENTER, NOMINATIM_URL } from "@/config/env";
import type { LatLng } from "./geo";

export interface GeocodeResult extends LatLng {
  label: string;
  /** Shorter display name (first 2–3 components). */
  short: string;
}

const cache = new Map<string, GeocodeResult[]>();
const reverseCache = new Map<string, string>();

const shorten = (displayName: string) => displayName.split(",").slice(0, 3).join(",").trim();

/**
 * Forward geocoding via Nominatim (OpenStreetMap). Results are biased toward
 * the configured map centre. Callers must debounce — the public server allows
 * about one request per second.
 */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<GeocodeResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const key = q.toLowerCase();
  const hit = cache.get(key);
  if (hit) return hit;

  const [lat, lng] = MAP_CENTER;
  const delta = 0.6; // ~65 km box, used as a soft preference
  const params = new URLSearchParams({
    q,
    format: "jsonv2",
    limit: "6",
    addressdetails: "0",
    viewbox: `${lng - delta},${lat + delta},${lng + delta},${lat - delta}`,
  });
  const res = await fetch(`${NOMINATIM_URL}/search?${params}`, {
    signal,
    headers: { "Accept-Language": navigator.language || "en" },
  });
  if (!res.ok) throw new Error("Address search is unavailable right now");
  const rows = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  const results = rows.map((r) => ({
    lat: Number(r.lat),
    lng: Number(r.lon),
    label: r.display_name,
    short: shorten(r.display_name),
  }));
  cache.set(key, results);
  return results;
}

/** Reverse geocode a pin to a readable address; resolves to null on failure. */
export async function reverseGeocode(point: LatLng, signal?: AbortSignal): Promise<string | null> {
  const key = `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`;
  const hit = reverseCache.get(key);
  if (hit) return hit;
  try {
    const params = new URLSearchParams({
      lat: String(point.lat),
      lon: String(point.lng),
      format: "jsonv2",
      zoom: "18",
    });
    const res = await fetch(`${NOMINATIM_URL}/reverse?${params}`, { signal });
    if (!res.ok) return null;
    const json = (await res.json()) as { display_name?: string };
    const label = json.display_name ? shorten(json.display_name) : null;
    if (label) reverseCache.set(key, label);
    return label;
  } catch {
    return null;
  }
}

/** Browser geolocation as a promise. */
export function currentPosition(options?: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Location is not supported on this device"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, (err) => {
      reject(
        new Error(
          err.code === err.PERMISSION_DENIED
            ? "Location permission was denied"
            : "Couldn't get your location — try again outdoors or pick on the map"
        )
      );
    }, { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000, ...options });
  });
}
