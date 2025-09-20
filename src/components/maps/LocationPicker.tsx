import { useEffect, useMemo, useRef, useState } from "react";
import { Marker, useMapEvents } from "react-leaflet";
import type { Marker as LeafletMarker } from "leaflet";
import { Crosshair, Loader2, MapPin, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAP_CENTER } from "@/config/env";
import { currentPosition, reverseGeocode, searchPlaces, type GeocodeResult } from "@/lib/geocode";
import type { LatLng } from "@/lib/geo";
import { errorMessage } from "@/hooks/api/core";
import { BaseMap } from "./BaseMap";
import { homeIcon } from "./icons";

export interface PickedLocation extends LatLng {
  address?: string | null;
}

function ClickToPlace({ onPick }: { onPick: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

interface LocationPickerProps {
  value: PickedLocation | null;
  onChange: (value: PickedLocation) => void;
  className?: string;
}

/**
 * Search an address, use GPS, or tap/drag the pin. Reverse-geocodes the pin
 * so the rider sees a readable address alongside exact coordinates.
 */
export function LocationPicker({ value, onChange, className }: LocationPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [fitTo, setFitTo] = useState<LatLng[] | undefined>(value ? [value] : undefined);
  const markerRef = useRef<LeafletMarker | null>(null);

  // debounced Nominatim search (public server: ~1 req/s)
  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const t = setTimeout(() => {
      setSearching(true);
      searchPlaces(query, controller.signal)
        .then(setResults)
        .catch((e) => e.name !== "AbortError" && setResults([]))
        .finally(() => setSearching(false));
    }, 700);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query]);

  const place = async (p: LatLng, address?: string | null, fly = false) => {
    onChange({ ...p, address: address ?? value?.address ?? null });
    if (fly) setFitTo([p]);
    if (!address) {
      const label = await reverseGeocode(p);
      if (label) onChange({ ...p, address: label });
    }
  };

  const useGps = async () => {
    setLocating(true);
    try {
      const pos = await currentPosition();
      await place({ lat: pos.coords.latitude, lng: pos.coords.longitude }, null, true);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setLocating(false);
    }
  };

  const handlers = useMemo(
    () => ({
      dragend() {
        const m = markerRef.current;
        if (m) {
          const ll = m.getLatLng();
          void place({ lat: ll.lat, lng: ll.lng });
        }
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [value]
  );

  return (
    <div className={className}>
      <div className="relative mb-2 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search area, street or landmark"
            className="pl-9"
            aria-label="Search address"
          />
          {searching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
          {results.length > 0 && (
            <ul className="absolute z-[1000] mt-1 max-h-60 w-full overflow-auto rounded-xl border bg-popover p-1 shadow-lift">
              {results.map((r) => (
                <li key={`${r.lat},${r.lng}`}>
                  <button
                    type="button"
                    className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-secondary"
                    onClick={() => {
                      setResults([]);
                      setQuery(r.short);
                      void place(r, r.short, true);
                    }}
                  >
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span className="line-clamp-2">{r.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Button type="button" variant="outline" onClick={useGps} disabled={locating} aria-label="Use my current location">
          {locating ? <Loader2 className="animate-spin" /> : <Crosshair />}
          <span className="hidden sm:inline">My location</span>
        </Button>
      </div>
      <BaseMap
        className="h-64 sm:h-72"
        center={value ?? MAP_CENTER}
        zoom={value ? 16 : 13}
        fitTo={fitTo}
        ariaLabel="Pick delivery location"
      >
        <ClickToPlace onPick={(p) => void place(p)} />
        {value && <Marker position={value} icon={homeIcon} draggable ref={markerRef} eventHandlers={handlers} />}
      </BaseMap>
      <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {value ? (
          <span>
            {value.address ?? "Pinned location"} · {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
          </span>
        ) : (
          <span>Tap the map, search, or use your location. Drag the pin to fine-tune.</span>
        )}
      </p>
    </div>
  );
}
