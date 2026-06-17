import { useMemo, useState, type ReactNode } from "react";
import type { DateRange as DayPickerRange } from "react-day-picker";
import { CalendarOff, Loader2, Palmtree, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useSetSkips, useUpdateSubscription } from "@/hooks/api/queries";
import { useIsMobile } from "@/hooks/use-mobile";
import { addDays, formatShortDate, parseLocalDate, toLocalISODate } from "@/lib/format";
import {
  DEFAULT_WINDOWS,
  MAX_SKIP_AHEAD_DAYS,
  MAX_VACATION_DAYS,
  dateRange,
  isDueOn,
  subscriptionSchedule,
  windowLabel,
} from "@/lib/schedule";
import { cn } from "@/lib/utils";
import type { Subscription } from "@/services";

/** Collapse sorted dates into contiguous ranges for display. */
function toRanges(dates: string[]): { from: string; to: string; dates: string[] }[] {
  const out: { from: string; to: string; dates: string[] }[] = [];
  for (const d of [...dates].sort()) {
    const last = out[out.length - 1];
    if (last && toLocalISODate(addDays(parseLocalDate(last.to), 1)) === d) {
      last.to = d;
      last.dates.push(d);
    } else out.push({ from: d, to: d, dates: [d] });
  }
  return out;
}

/**
 * Per-subscription controls: preferred delivery window, tap-to-skip on a
 * 14-day schedule, and vacation mode (skip a date range, up to 60 days).
 */
export function SubscriptionManager({ sub, trigger }: { sub: Subscription; trigger: ReactNode }) {
  const isMobile = useIsMobile();
  const update = useUpdateSubscription();
  const setSkips = useSetSkips();
  const [range, setRange] = useState<DayPickerRange | undefined>();
  const today = toLocalISODate();
  const tomorrow = parseLocalDate(toLocalISODate(addDays(new Date(), 1)));
  const schedule = useMemo(() => subscriptionSchedule(sub, sub.skip_dates, today, 14), [sub, today]);
  const ranges = toRanges(sub.skip_dates);

  const vacationDates = range?.from ? dateRange(toLocalISODate(range.from), toLocalISODate(range.to ?? range.from)) : [];
  const dueInVacation = vacationDates.filter((d) => isDueOn(sub, d)).length;
  const tooLong = vacationDates.length > MAX_VACATION_DAYS;

  const toggle = (date: string, skipped: boolean) =>
    setSkips.mutate({
      id: sub.id,
      dates: [date],
      skip: !skipped,
      message: skipped ? `Delivery on ${formatShortDate(date)} restored` : `Skipped ${formatShortDate(date)} — you won't be charged`,
    });

  return (
    <Sheet>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side={isMobile ? "bottom" : "right"} className="max-h-[92svh] overflow-y-auto sm:max-w-md">
        <SheetHeader className="text-left">
          <SheetTitle>Manage subscription</SheetTitle>
          <SheetDescription>
            {sub.product_name} · {sub.quantity} L {sub.frequency}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-7">
          <section className="space-y-2">
            <Label>Delivery window</Label>
            <Select
              value={sub.preferred_slot_start ?? "any"}
              disabled={update.isPending}
              onValueChange={(v) => update.mutate({ id: sub.id, preferred_slot_start: v === "any" ? null : v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Earliest available</SelectItem>
                {DEFAULT_WINDOWS.map((w) => (
                  <SelectItem key={w.start} value={w.start}>
                    {windowLabel(w.start, w.end)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">If your window is full we'll use the next one that day.</p>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Next 14 days</Label>
              <span className="text-xs text-muted-foreground">Tap a delivery day to skip it</span>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {schedule.map((d) => {
                const date = parseLocalDate(d.date);
                const editable = d.due && d.date > today && sub.status === "active";
                return (
                  <button
                    key={d.date}
                    type="button"
                    disabled={!editable || setSkips.isPending}
                    onClick={() => toggle(d.date, d.skipped)}
                    title={d.date === today ? "Today's delivery can't be changed" : undefined}
                    aria-label={`${d.date}${d.due ? (d.skipped ? ", skipped" : ", delivery") : ", no delivery"}`}
                    className={cn(
                      "flex flex-col items-center rounded-lg border py-1.5 text-[11px] transition-colors",
                      !d.due && "border-dashed text-muted-foreground/60",
                      d.due && !d.skipped && "border-primary/40 bg-primary-soft text-primary",
                      d.due && d.skipped && "border-warning/50 bg-warning-soft text-[hsl(30_80%_32%)] line-through dark:text-warning",
                      editable && "hover:ring-2 hover:ring-primary/30",
                      d.date === today && "opacity-70"
                    )}
                  >
                    <span className="uppercase">{date.toLocaleDateString("en-IN", { weekday: "narrow" })}</span>
                    <span className="text-sm font-bold">{date.getDate()}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded bg-primary-soft ring-1 ring-primary/40" /> Delivery
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded bg-warning-soft ring-1 ring-warning/50" /> Skipped
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded border border-dashed" /> No delivery
              </span>
            </div>
          </section>

          <section className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Palmtree className="h-4 w-4 text-primary" /> Vacation mode
            </Label>
            <p className="text-xs text-muted-foreground">
              Pick the days you're away. No deliveries and no charges — it resumes automatically.
            </p>
            <div className="flex justify-center rounded-xl border">
              <Calendar
                mode="range"
                numberOfMonths={1}
                selected={range}
                onSelect={setRange}
                defaultMonth={tomorrow}
                disabled={[{ before: tomorrow }, { after: addDays(new Date(), MAX_SKIP_AHEAD_DAYS) }]}
              />
            </div>
            {range?.from && (
              <p className={cn("text-sm", tooLong && "text-destructive")}>
                {tooLong
                  ? `Vacations can be at most ${MAX_VACATION_DAYS} days.`
                  : `${vacationDates.length} day${vacationDates.length > 1 ? "s" : ""} · ${dueInVacation} deliver${dueInVacation === 1 ? "y" : "ies"} paused`}
              </p>
            )}
            <Button
              className="w-full"
              disabled={!range?.from || tooLong || setSkips.isPending || sub.status !== "active"}
              onClick={() =>
                setSkips.mutate(
                  {
                    id: sub.id,
                    dates: vacationDates,
                    skip: true,
                    message: `Vacation set: ${formatShortDate(vacationDates[0])} – ${formatShortDate(vacationDates[vacationDates.length - 1])}`,
                  },
                  { onSuccess: () => setRange(undefined) }
                )
              }
            >
              {setSkips.isPending ? <Loader2 className="animate-spin" /> : <Palmtree />} Pause for these days
            </Button>
          </section>

          <section className="space-y-2">
            <Label>Upcoming skips</Label>
            {ranges.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarOff className="h-4 w-4" /> None planned
              </p>
            ) : (
              <ul className="space-y-1.5">
                {ranges.map((r) => (
                  <li key={r.from} className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm">
                    <span>
                      {r.from === r.to ? formatShortDate(r.from) : `${formatShortDate(r.from)} – ${formatShortDate(r.to)}`}
                      <span className="text-muted-foreground"> · {r.dates.length > 1 ? "vacation" : "skip"}</span>
                    </span>
                    <Button
                      size="xs"
                      variant="ghost"
                      disabled={setSkips.isPending}
                      onClick={() => setSkips.mutate({ id: sub.id, dates: r.dates.filter((d) => d > today), skip: false, message: "Deliveries restored" })}
                    >
                      <Undo2 className="!size-3" /> Undo
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
