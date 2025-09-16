import { useEffect, useState } from "react";
import { Polyline } from "react-leaflet";
import { getRoute, type RouteResult } from "@/lib/routing";
import type { LatLng } from "@/lib/geo";

const keyOf = (points: LatLng[]) => points.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join(";");

/** Road route through waypoints (OSRM, falling back to an estimate). */
export function useRoute(points: LatLng[] | null | undefined): { route: RouteResult | null; loading: boolean } {
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const key = points && points.length > 1 ? keyOf(points) : "";

  useEffect(() => {
    if (!key || !points) {
      setRoute(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getRoute(points)
      .then((r) => !cancelled && setRoute(r))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { route, loading };
}

interface RouteLineProps {
  path: LatLng[];
  /** Straight-line estimates are drawn dashed so they read as approximate. */
  estimated?: boolean;
  color?: string;
  weight?: number;
  muted?: boolean;
}

export function RouteLine({ path, estimated, color = "hsl(var(--primary))", weight = 5, muted }: RouteLineProps) {
  if (path.length < 2) return null;
  return (
    <>
      <Polyline
        positions={path}
        pathOptions={{ color: "hsl(var(--card))", weight: weight + 4, opacity: muted ? 0.5 : 0.9, lineCap: "round" }}
      />
      <Polyline
        positions={path}
        pathOptions={{
          color,
          weight,
          opacity: muted ? 0.45 : 0.95,
          lineCap: "round",
          lineJoin: "round",
          dashArray: estimated ? "8 10" : undefined,
        }}
      />
    </>
  );
}
