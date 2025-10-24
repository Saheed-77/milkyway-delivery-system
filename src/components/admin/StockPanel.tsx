import { useState } from "react";
import { Archive, CalendarPlus, Loader2, Minus, Package, Plus } from "lucide-react";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdjustStock, useArchiveAndReset, useReserveTomorrow, useStockToday } from "@/hooks/api/queries";
import { formatLiters } from "@/lib/format";

function AdjustStock() {
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const adjust = useAdjustStock();
  const n = Number(value);
  const run = (sign: 1 | -1) =>
    adjust.mutate(sign * n, {
      onSuccess: () => {
        setValue("");
        setOpen(false);
      },
    });
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline">
          <Package /> Adjust
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 rounded-xl" align="end">
        <p className="mb-2 text-sm font-semibold">Manual stock correction</p>
        <Input type="number" inputMode="decimal" min={0} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Liters" />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button size="sm" variant="outline" disabled={!(n > 0) || adjust.isPending} onClick={() => run(-1)}>
            <Minus /> Remove
          </Button>
          <Button size="sm" disabled={!(n > 0) || adjust.isPending} onClick={() => run(1)}>
            <Plus /> Add
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Today's stock with reservation-aware availability and daily operations. */
export function StockPanel({ compact }: { compact?: boolean }) {
  const { data, isLoading } = useStockToday();
  const reserve = useReserveTomorrow();
  const archive = useArchiveAndReset();

  const total = data?.total_stock ?? 0;
  const reserved = data?.reserved_today ?? 0;
  const pct = total > 0 ? Math.min(100, (reserved / total) * 100) : 0;

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle>Today's stock</CardTitle>
          <CardDescription>Collections in, orders out. Subscription reservations are held back.</CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <AdjustStock />
          {!compact && (
            <>
              <Button size="sm" variant="outline" disabled={reserve.isPending} onClick={() => reserve.mutate()}>
                {reserve.isPending ? <Loader2 className="animate-spin" /> : <CalendarPlus />} Reserve tomorrow
              </Button>
              <ConfirmDialog
                trigger={
                  <Button size="sm" variant="outline">
                    <Archive /> Close day
                  </Button>
                }
                title="Archive yesterday and carry leftover?"
                description="Saves yesterday's closing stock to the archive and adds leftover milk (after subscription demand) to today. Safe to run once per day — it does nothing if already archived."
                confirmLabel="Archive & carry over"
                onConfirm={() => archive.mutateAsync()}
              />
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading || !data ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Available to order</p>
                <p className="text-4xl font-extrabold tabular-nums text-primary">{formatLiters(data.available_stock, 1)}</p>
              </div>
              <div className="text-right text-sm">
                <p className="font-semibold tabular-nums">{formatLiters(total, 1)} in stock</p>
                <p className="text-muted-foreground">{formatLiters(reserved, 1)} reserved</p>
              </div>
            </div>
            <Progress value={pct} className="h-2" aria-label="Share of stock reserved for subscriptions" />
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              {[
                ["Sold today", data.sold_stock],
                ["Carried over", data.leftover_from_yesterday],
                ["Daily sub. demand", data.subscription_demand],
                ["Reserved tomorrow", data.reserved_tomorrow],
              ].map(([label, v]) => (
                <div key={label as string} className="rounded-xl bg-muted/60 p-3">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="font-semibold tabular-nums">{formatLiters(v as number, 1)}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </CardContent>
    </Card>
  );
}
