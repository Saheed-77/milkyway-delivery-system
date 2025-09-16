import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { Marker, Popup, Tooltip } from "react-leaflet";
import type { Marker as LeafletMarker } from "leaflet";
import { riderIcon } from "./icons";
import type { LatLng } from "@/lib/geo";

interface RiderMarkerProps {
  position: LatLng;
  heading?: number | null;
  color?: string;
  label?: string;
  tooltip?: ReactNode;
  popup?: ReactNode;
  onClick?: () => void;
}

/**
 * Rider marker that glides between position updates instead of jumping
 * (updates arrive every ~1–5 s from GPS / realtime / the demo simulator).
 */
export function RiderMarker({ position, heading = null, color, label, tooltip, popup, onClick }: RiderMarkerProps) {
  const markerRef = useRef<LeafletMarker | null>(null);
  const shown = useRef<LatLng>(position);
  const frame = useRef<number>();

  // Round heading so tiny GPS jitter doesn't rebuild the icon every update.
  const roundedHeading = heading == null ? null : Math.round(heading / 10) * 10;
  const icon = useMemo(() => riderIcon(roundedHeading, color, label), [roundedHeading, color, label]);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;
    const from = { ...shown.current };
    const to = position;
    const start = performance.now();
    const duration = 900;
    cancelAnimationFrame(frame.current!);
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2; // easeInOutQuad
      const p = { lat: from.lat + (to.lat - from.lat) * e, lng: from.lng + (to.lng - from.lng) * e };
      shown.current = p;
      marker.setLatLng(p);
      if (t < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame.current!);
  }, [position.lat, position.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Marker
      ref={markerRef}
      position={shown.current}
      icon={icon}
      zIndexOffset={1000}
      eventHandlers={onClick ? { click: onClick } : undefined}
    >
      {tooltip && (
        <Tooltip direction="top" offset={[0, -18]} opacity={1}>
          {tooltip}
        </Tooltip>
      )}
      {popup && <Popup>{popup}</Popup>}
    </Marker>
  );
}
