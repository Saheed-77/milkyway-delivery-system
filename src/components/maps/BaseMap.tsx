import "leaflet/dist/leaflet.css";
import { useEffect, type ReactNode } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import type { LatLngBoundsExpression, LatLngExpression, Map as LeafletMap } from "leaflet";
import { MAP_CENTER, TILE_ATTRIBUTION, TILE_URL } from "@/config/env";
import { boundsOf, type LatLng } from "@/lib/geo";
import { cn } from "@/lib/utils";

interface BaseMapProps {
  center?: LatLngExpression;
  zoom?: number;
  className?: string;
  children?: ReactNode;
  /** Fit the view to these points. */
  fitTo?: LatLng[];
  /**
   * Refit only when this key changes (e.g. the set of stop ids). Without it
   * the map refits whenever the points move, which fights the user's panning
   * when live rider positions are included.
   */
  fitKey?: string;
  fitPadding?: number;
  scrollWheelZoom?: boolean;
  onReady?: (map: LeafletMap) => void;
  ariaLabel?: string;
}

/** Keeps tiles correct when the container resizes (tabs, sheets, sidebars). */
function AutoResize() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);
  return null;
}

function FitBounds({ points, padding, fitKey }: { points: LatLng[]; padding: number; fitKey?: string }) {
  const map = useMap();
  const key = fitKey ?? points.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join("|");
  useEffect(() => {
    const b = boundsOf(points);
    if (!b) return;
    // The container may have just been laid out (lazy route, tabs); measure first.
    const frame = requestAnimationFrame(() => {
      map.invalidateSize();
      if (points.length === 1) map.setView(b[0], Math.max(map.getZoom(), 15), { animate: false });
      else map.fitBounds(b as LatLngBoundsExpression, { padding: [padding, padding], maxZoom: 16, animate: false });
    });
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key, padding]);
  return null;
}

function Ready({ onReady }: { onReady: (map: LeafletMap) => void }) {
  const map = useMap();
  useEffect(() => onReady(map), [map, onReady]);
  return null;
}

export function BaseMap({
  center = MAP_CENTER,
  zoom = 13,
  className,
  children,
  fitTo,
  fitKey,
  fitPadding = 48,
  scrollWheelZoom = true,
  onReady,
  ariaLabel = "Map",
}: BaseMapProps) {
  return (
    <div className={cn("relative isolate overflow-hidden rounded-2xl border bg-muted", className)} role="region" aria-label={ariaLabel}>
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={scrollWheelZoom}
        className="h-full w-full"
        zoomControl
        attributionControl
      >
        {/* dark mode is a CSS filter on the tile pane (see index.css), so one tile source serves both themes */}
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={19} />
        <AutoResize />
        {fitTo && fitTo.length > 0 && <FitBounds points={fitTo} padding={fitPadding} fitKey={fitKey} />}
        {onReady && <Ready onReady={onReady} />}
        {children}
      </MapContainer>
    </div>
  );
}
