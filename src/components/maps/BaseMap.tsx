import "leaflet/dist/leaflet.css";
import { useEffect, type ReactNode } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import { useTheme } from "next-themes";
import type { LatLngBoundsExpression, LatLngExpression, Map as LeafletMap } from "leaflet";
import { MAP_CENTER } from "@/config/env";
import { boundsOf, type LatLng } from "@/lib/geo";
import { cn } from "@/lib/utils";

const TILES = {
  light: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
};
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

interface BaseMapProps {
  center?: LatLngExpression;
  zoom?: number;
  className?: string;
  children?: ReactNode;
  /** Fit the view to these points whenever the set changes. */
  fitTo?: LatLng[];
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

function FitBounds({ points, padding }: { points: LatLng[]; padding: number }) {
  const map = useMap();
  const key = points.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join("|");
  useEffect(() => {
    const b = boundsOf(points);
    if (!b) return;
    if (points.length === 1) map.setView(b[0], Math.max(map.getZoom(), 15), { animate: true });
    else map.fitBounds(b as LatLngBoundsExpression, { padding: [padding, padding], maxZoom: 16, animate: true });
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
  fitPadding = 48,
  scrollWheelZoom = true,
  onReady,
  ariaLabel = "Map",
}: BaseMapProps) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
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
        <TileLayer key={dark ? "dark" : "light"} url={dark ? TILES.dark : TILES.light} attribution={ATTRIBUTION} subdomains="abcd" maxZoom={20} />
        <AutoResize />
        {fitTo && fitTo.length > 0 && <FitBounds points={fitTo} padding={fitPadding} />}
        {onReady && <Ready onReady={onReady} />}
        {children}
      </MapContainer>
    </div>
  );
}
