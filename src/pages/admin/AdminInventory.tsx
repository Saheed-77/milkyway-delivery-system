import { useState } from "react";
import { Archive, BarChart3, Droplets, Gauge, TrendingDown, TrendingUp } from "lucide-react";
import { StockPanel } from "@/components/admin/StockPanel";
import { TrendChart } from "@/components/charts/TrendChart";
import { DateRangePicker } from "@/components/common/DateRangePicker";
import { EmptyState, ErrorState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { ResponsiveTable } from "@/components/common/ResponsiveTable";
import { ListSkeleton } from "@/components/common/Skeletons";
import { StatCard } from "@/components/common/StatCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useInventorySummary, useStockArchive } from "@/hooks/api/queries";
import { addDays, formatDate, formatLiters, formatShortDate, toLocalISODate } from "@/lib/format";
import type { DateRange } from "@/services";

export default function AdminInventory() {
  const [period, setPeriod] = useState(30);
  const [range, setRange] = useState<DateRange | undefined>({ from: toLocalISODate(addDays(new Date(), -30)), to: toLocalISODate(addDays(new Date(), -1)) });
  const summary = useInventorySummary(period);
  const archive = useStockArchive(range);
  const rows = archive.data ?? [];
  const chart = [...rows]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => ({ key: r.date, label: formatShortDate(r.date), stock: r.total_stock, demand: r.subscription_demand, leftover: r.leftover_milk }));
  const s = summary.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Daily stock, subscription reservations and the closing-stock archive."
        actions={
          <Tabs value={String(period)} onValueChange={(v) => setPeriod(Number(v))}>
            <TabsList>
              <TabsTrigger value="7">7 days</TabsTrigger>
              <TabsTrigger value="30">30 days</TabsTrigger>
              <TabsTrigger value="90">90 days</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />
      <StockPanel />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Avg. closing stock" value={s ? formatLiters(s.avg_total_stock, 0) : "—"} hint={s ? `${s.total_days} days archived` : "no archive yet"} icon={Gauge} loading={summary.isLoading} />
        <StatCard label="Avg. sub. demand" value={s ? formatLiters(s.avg_subscription_demand, 1) : "—"} icon={Droplets} tone="info" loading={summary.isLoading} />
        <StatCard label="Peak day" value={s ? formatLiters(s.max_total_stock, 0) : "—"} icon={TrendingUp} tone="success" loading={summary.isLoading} />
        <StatCard label="Lowest day" value={s ? formatLiters(s.min_total_stock, 0) : "—"} icon={TrendingDown} tone="warning" loading={summary.isLoading} />
      </div>

      <Card>
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-2 space-y-0">
          <div>
            <CardTitle>Closing stock history</CardTitle>
            <CardDescription>End-of-day stock vs. subscription demand and carried-over milk</CardDescription>
          </div>
          <DateRangePicker value={range} onChange={setRange} />
        </CardHeader>
        <CardContent className="space-y-6">
          {archive.isLoading ? (
            <ListSkeleton />
          ) : archive.error ? (
            <ErrorState error={archive.error} onRetry={() => archive.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState icon={Archive} title="Nothing archived in this range" description="Use “Close day” to archive yesterday's stock, or schedule it nightly with pg_cron." compact />
          ) : (
            <>
              <TrendChart
                legend
                data={chart}
                config={{
                  stock: { label: "Closing stock", color: "hsl(var(--chart-1))" },
                  demand: { label: "Sub. demand", color: "hsl(var(--chart-2))" },
                  leftover: { label: "Carried over", color: "hsl(var(--chart-3))" },
                }}
                valueFormatter={(v) => formatLiters(v)}
              />
              <ResponsiveTable>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Closing stock</TableHead>
                      <TableHead className="text-right">Sub. demand</TableHead>
                      <TableHead className="text-right">Available</TableHead>
                      <TableHead className="text-right">Carried over</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{formatDate(r.date)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatLiters(r.total_stock, 1)}</TableCell>
                        {/* demand is fractional (weekly/7, monthly/30) — rounded instead of printing 0.142857… */}
                        <TableCell className="text-right tabular-nums">{formatLiters(r.subscription_demand, 1)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatLiters(r.available_stock, 1)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatLiters(r.leftover_milk, 1)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ResponsiveTable>
            </>
          )}
        </CardContent>
      </Card>
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <BarChart3 className="h-3.5 w-3.5" /> Tip: enable the optional pg_cron jobs in the migration to archive and reserve automatically every night.
      </p>
    </div>
  );
}
