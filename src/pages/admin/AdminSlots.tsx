import { useState } from "react";
import { CalendarClock, Check, Lock, Moon, Sun, Unlock } from "lucide-react";
import { EmptyState, ErrorState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { CardSkeleton } from "@/components/common/Skeletons";
import { StatCard } from "@/components/common/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useDeliverySlots, useUpdateSlot } from "@/hooks/api/queries";
import { toLocalISODate } from "@/lib/format";
import { dayLabel, isMorning, isSlotClosed, windowLabel } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import type { DeliverySlot } from "@/services";

function SlotRow({ slot }: { slot: DeliverySlot }) {
  const update = useUpdateSlot();
  const [capacity, setCapacity] = useState(String(slot.capacity));
  const closedByTime = isSlotClosed(slot.date, slot.start);
  const pct = Math.min(100, (slot.booked / Math.max(1, slot.capacity)) * 100);
  const dirty = Number(capacity) !== slot.capacity;
  const Icon = isMorning(slot.start) ? Sun : Moon;

  return (
    <li className={cn("space-y-2 rounded-xl border p-3", !slot.is_active && "bg-muted/60")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <Icon className="h-4 w-4 text-muted-foreground" /> {windowLabel(slot.start, slot.end)}
        </span>
        {!slot.is_active ? (
          <Badge variant="muted">Closed</Badge>
        ) : closedByTime ? (
          <Badge variant="muted">Past cutoff</Badge>
        ) : slot.booked >= slot.capacity ? (
          <Badge variant="danger">Full</Badge>
        ) : (
          <Badge variant="success">{slot.capacity - slot.booked} open</Badge>
        )}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Progress value={pct} className="h-1.5 flex-1" aria-label={`${slot.booked} of ${slot.capacity} booked`} />
        <span className="w-16 text-right tabular-nums">
          {slot.booked}/{slot.capacity}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={Math.max(1, slot.booked)}
          max={500}
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          className="h-8 w-20"
          aria-label="Capacity"
        />
        <Button size="xs" variant="soft" disabled={!dirty || update.isPending} onClick={() => update.mutate({ id: slot.id, capacity: Number(capacity) })}>
          <Check className="!size-3" /> Save
        </Button>
        <Button
          size="xs"
          variant="ghost"
          className="ml-auto"
          disabled={update.isPending}
          onClick={() => update.mutate({ id: slot.id, is_active: !slot.is_active })}
        >
          {slot.is_active ? <Lock className="!size-3" /> : <Unlock className="!size-3" />}
          {slot.is_active ? "Close" : "Reopen"}
        </Button>
      </div>
    </li>
  );
}

export default function AdminSlots() {
  const today = toLocalISODate();
  const { data = [], isLoading, error, refetch } = useDeliverySlots(today, 7);
  const days = [...new Set(data.map((s) => s.date))];
  const todays = data.filter((s) => s.date === today);
  const next7 = data.reduce((n, s) => n + s.booked, 0);
  const cap7 = data.filter((s) => s.is_active).reduce((n, s) => n + s.capacity, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Delivery slots" description="Capacity per delivery window for the next 7 days. Orders close 30 minutes before a window starts." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Booked today" value={todays.reduce((n, s) => n + s.booked, 0)} icon={CalendarClock} loading={isLoading} />
        <StatCard label="Booked, next 7 days" value={next7} icon={CalendarClock} tone="info" loading={isLoading} />
        <StatCard
          label="Utilisation"
          value={cap7 ? `${Math.round((next7 / cap7) * 100)}%` : "—"}
          hint={`${cap7} seats open`}
          icon={CalendarClock}
          tone="success"
          loading={isLoading}
          className="col-span-2 lg:col-span-1"
        />
      </div>
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : days.length === 0 ? (
        <EmptyState icon={CalendarClock} title="No slots" compact />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {days.map((d) => (
            <Card key={d}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {dayLabel(d, today)} <span className="text-sm font-normal text-muted-foreground">· {d}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {data
                    .filter((s) => s.date === d)
                    .map((s) => (
                      <SlotRow key={`${s.id}-${s.capacity}`} slot={s} />
                    ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
