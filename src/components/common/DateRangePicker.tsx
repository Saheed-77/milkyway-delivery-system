import { CalendarDays, X } from "lucide-react";
import type { DateRange as DayPickerRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
import { addDays, formatShortDate, parseLocalDate, toLocalISODate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DateRange } from "@/services";

interface DateRangePickerProps {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  className?: string;
  placeholder?: string;
}

const PRESETS: { label: string; days: number }[] = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
];

/**
 * Inclusive local-date range picker. Always clearable — the old picker
 * disappeared when a filter matched nothing, trapping the user.
 */
export function DateRangePicker({ value, onChange, className, placeholder = "All dates" }: DateRangePickerProps) {
  const isMobile = useIsMobile();
  const selected: DayPickerRange | undefined = value?.from
    ? { from: parseLocalDate(value.from), to: value.to ? parseLocalDate(value.to) : undefined }
    : undefined;

  const label = value?.from
    ? value.to && value.to !== value.from
      ? `${formatShortDate(value.from)} – ${formatShortDate(value.to)}`
      : formatShortDate(value.from)
    : placeholder;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("justify-start font-medium", !value?.from && "text-muted-foreground")}>
            <CalendarDays />
            {label}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto rounded-2xl p-0" align="start">
          <div className="flex flex-wrap gap-1 border-b p-2">
            {PRESETS.map((p) => (
              <Button
                key={p.days}
                size="xs"
                variant="ghost"
                onClick={() =>
                  onChange({ from: toLocalISODate(addDays(new Date(), -p.days + 1)), to: toLocalISODate() })
                }
              >
                Last {p.label}
              </Button>
            ))}
          </div>
          <Calendar
            mode="range"
            numberOfMonths={isMobile ? 1 : 2}
            selected={selected}
            defaultMonth={selected?.from ?? addDays(new Date(), -30)}
            disabled={{ after: new Date() }}
            onSelect={(r) =>
              onChange(
                r?.from
                  ? { from: toLocalISODate(r.from), to: toLocalISODate(r.to ?? r.from) }
                  : undefined
              )
            }
          />
        </PopoverContent>
      </Popover>
      {value?.from && (
        <Button variant="ghost" size="icon-sm" aria-label="Clear date filter" onClick={() => onChange(undefined)}>
          <X />
        </Button>
      )}
    </div>
  );
}
