/**
 * Runtime configuration derived from Vite env vars.
 *
 * Demo mode runs the whole app against an in-browser mock backend (seeded
 * data persisted to localStorage). It is enabled explicitly with
 * VITE_DEMO_MODE=true, or automatically when no Supabase URL is configured —
 * so a plain `vercel deploy` with no env vars gives a working demo.
 */
const env = import.meta.env;

export const SUPABASE_URL = (env.VITE_SUPABASE_URL as string | undefined)?.trim() || "";
export const SUPABASE_ANON_KEY =
  (env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || "";

export const IS_DEMO =
  env.VITE_DEMO_MODE === "true" || !SUPABASE_URL || !SUPABASE_ANON_KEY;

function parseCenter(raw: string | undefined): [number, number] {
  if (raw) {
    const [lat, lng] = raw.split(",").map((v) => Number(v.trim()));
    if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
  }
  // Kochi, Kerala
  return [9.9816, 76.2999];
}

export const MAP_CENTER = parseCenter(env.VITE_MAP_CENTER as string | undefined);

/** Public OSRM server by default; point at your own instance in production. */
export const OSRM_URL =
  (env.VITE_OSRM_URL as string | undefined)?.replace(/\/$/, "") ||
  "https://router.project-osrm.org";

export const NOMINATIM_URL =
  (env.VITE_NOMINATIM_URL as string | undefined)?.replace(/\/$/, "") ||
  "https://nominatim.openstreetmap.org";
