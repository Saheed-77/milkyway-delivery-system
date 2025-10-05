import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/services";
import { isSelfDriving, setSelfDrive } from "@/services/mock/simulator";
import { haversine, type LatLng } from "@/lib/geo";

const MIN_INTERVAL_MS = 5000;
const MIN_MOVE_M = 10;

/**
 * Rider location sharing. Live mode streams real GPS (throttled to ~5 s or
 * 10 m) to update_rider_location. Demo mode has no real movement on a
 * desktop, so "sharing" switches on the simulator driving this rider along
 * the route instead.
 */
export function useRiderGps(riderId: string | undefined) {
  const demo = api.mode === "demo";
  const [sharing, setSharing] = useState(() => (demo && riderId ? isSelfDriving(riderId) : false));
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState<LatLng | null>(null);
  const watchId = useRef<number | null>(null);
  const last = useRef<{ at: number; pos: LatLng } | null>(null);

  const stopWatch = () => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
  };

  const start = useCallback(() => {
    setError(null);
    if (!riderId) return;
    if (demo) {
      setSelfDrive(riderId, true);
      setSharing(true);
      return;
    }
    if (!("geolocation" in navigator)) {
      setError("Location isn't available on this device");
      return;
    }
    stopWatch();
    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        const pos = { lat: p.coords.latitude, lng: p.coords.longitude };
        setPosition(pos);
        const now = Date.now();
        const prev = last.current;
        if (prev && now - prev.at < MIN_INTERVAL_MS && haversine(prev.pos, pos) < MIN_MOVE_M) return;
        last.current = { at: now, pos };
        api.delivery
          .updateLocation({ ...pos, heading: p.coords.heading ?? null, speed: p.coords.speed ?? null })
          .catch((e) => setError(e instanceof Error ? e.message : "Couldn't send location"));
      },
      (err) => {
        setError(err.code === err.PERMISSION_DENIED ? "Location permission denied — enable it to share your position" : "GPS signal lost");
        if (err.code === err.PERMISSION_DENIED) {
          stopWatch();
          setSharing(false);
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
    setSharing(true);
  }, [demo, riderId]);

  const stop = useCallback(() => {
    if (demo && riderId) setSelfDrive(riderId, false);
    stopWatch();
    setSharing(false);
  }, [demo, riderId]);

  useEffect(() => () => stopWatch(), []);

  return { sharing, start, stop, error, position, demo };
}
