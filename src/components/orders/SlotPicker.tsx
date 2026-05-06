import { useMemo, useState } from "react";
import { Moon, Sun, Zap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeliverySlots } from "@/hooks/api/queries";
import { toLocalISODate } from "@/lib/format";
import { dayLabel, isMorning, SLOT_DAYS_AHEAD, windowLabel } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import type { DeliverySlot } from "@/services";

interface SlotPickerProps {
  /** null = express (within the hour) */
  value: string | null;
  onChange: (slot: DeliverySlot | null) => void;
}

/** Express delivery or a booked window for today and the next few days, with live seats left. */
export function SlotPicker({ value, onChange }: SlotPickerProps) {
  const today = toLocalISODate();
  const { data = [], isLoading } = useDeliverySlots(today, SLOT_DAYS_AHEAD + 1);
  const days = useMemo(() => [...new Set(data.map((s) => s.date))], [data]);
  const selected = data.find((s) => s.id === value);
  const [day, setDay] = useState<string | null>(null);
  const activeDay = day ?? selected?.date ?? days.find((d) => data.some((s) => s.date === d && s.available)) ?? days[0];

  if (isLoading) return <Skeleton className="h-36 w-full rounded-2xl" />;

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => onChange(null)}
        aria-pressed={value === null}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
          value === null ? "border-primary bg-primary-soft/50 ring-2 ring-primary/20" : "hover:bg-muted/50"
        )}
      >
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-warning-soft text-warning">
          <Zap className="h-4 w-4" />
        </span>
        <span className="flex-1">
          <span className="block font-semibold">Express</span>
          <span className="block text-xs text-muted-foreground">Nearest rider, usually within the hour</span>
        </span>
      </button>

      <div className="flex gap-1 overflow-x-auto rounded-xl bg-muted p-1" role="tablist" aria-label="Delivery day">
        {days.map((d) => (
          <button
            key={d}
            type="button"
            role="tab"
            aria-selected={d === activeDay}
            onClick={() => setDay(d)}
            className={cn(
              "shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm",
              d === activeDay ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {dayLabel(d, today)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {data
          .filter((s) => s.date === activeDay)
          .map((s) => {
            const left = Math.max(0, s.capacity - s.booked);
            const reason = !s.is_active ? "Closed" : left === 0 ? "Full" : !s.available ? "Closed" : left <= 5 ? `${left} left` : "Available";
            const Icon = isMorning(s.start) ? Sun : Moon;
            return (
              <button
                key={s.id}
                type="button"
                disabled={!s.available}
                onClick={() => onChange(s)}
                aria-pressed={value === s.id}
                className={cn(
                  "rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                  value === s.id ? "border-primary bg-primary-soft/50 ring-2 ring-primary/20" : "hover:bg-muted/50"
                )}
              >
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" /> {windowLabel(s.start, s.end)}
                </span>
                <span className={cn("text-xs", left <= 5 && s.available ? "font-semibold text-warning" : "text-muted-foreground")}>{reason}</span>
              </button>
            );
          })}
      </div>
    </div>
  );
}
