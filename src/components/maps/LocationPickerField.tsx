import { lazy, Suspense, useState } from "react";
import { MapPin, MapPinned } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type { PickedLocation } from "./LocationPicker";

export type { PickedLocation };

// Leaflet is only downloaded when someone actually opens the picker.
const LocationPicker = lazy(() => import("./LocationPicker").then((m) => ({ default: m.LocationPicker })));

interface LocationPickerFieldProps {
  value: PickedLocation | null;
  onChange: (value: PickedLocation | null) => void;
  label?: string;
  hint?: string;
}

export function LocationPickerField({ value, onChange, label = "Delivery location", hint }: LocationPickerFieldProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<PickedLocation | null>(value);

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <button
        type="button"
        onClick={() => {
          setDraft(value);
          setOpen(true);
        }}
        className="flex w-full items-center gap-3 rounded-xl border border-dashed bg-card px-3 py-3 text-left text-sm transition-colors hover:border-primary hover:bg-primary-soft/40"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
          {value ? <MapPinned className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{value ? value.address ?? "Pinned on map" : "Pin location on map"}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {value ? `${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}` : hint ?? "Helps riders find you faster"}
          </span>
        </span>
        <span className="text-xs font-semibold text-primary">{value ? "Change" : "Add"}</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>Set delivery location</DialogTitle>
            <DialogDescription>Search for your address or drop the pin exactly at your gate.</DialogDescription>
          </DialogHeader>
          <Suspense fallback={<Skeleton className="h-80 w-full rounded-2xl" />}>
            <LocationPicker value={draft} onChange={setDraft} />
          </Suspense>
          <DialogFooter className="gap-2">
            {value && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                Remove pin
              </Button>
            )}
            <Button
              type="button"
              disabled={!draft}
              onClick={() => {
                onChange(draft);
                setOpen(false);
              }}
            >
              Use this location
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
