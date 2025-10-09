import { useState } from "react";
import { Banknote, CheckCircle2, Milk, Timer } from "lucide-react";
import { DateRangePicker } from "@/components/common/DateRangePicker";
import { EmptyState, ErrorState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { ResponsiveTable } from "@/components/common/ResponsiveTable";
import { ListSkeleton } from "@/components/common/Skeletons";
import { StatCard } from "@/components/common/StatCard";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMyCompleted } from "@/hooks/api/queries";
import { formatCurrency, formatDateTime, formatDuration, formatLiters, toLocalISODate } from "@/lib/format";
import type { DateRange } from "@/services";

export default function Completed() {
  const [range, setRange] = useState<DateRange | undefined>({ from: toLocalISODate(), to: toLocalISODate() });
  const { data = [], isLoading, error, refetch } = useMyCompleted(range);

  const liters = data.reduce((s, o) => s + o.quantity, 0);
  const cash = data.filter((o) => o.payment_method === "cash").reduce((s, o) => s + o.total_amount, 0);
  const times = data
    .filter((o) => o.picked_up_at && o.delivered_at)
    .map((o) => (new Date(o.delivered_at!).getTime() - new Date(o.picked_up_at!).getTime()) / 1000);
  const avg = times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Completed deliveries"
        description="Your delivery log and cash to hand over."
        actions={<DateRangePicker value={range} onChange={setRange} placeholder="All time" />}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Delivered" value={data.length} icon={CheckCircle2} tone="success" loading={isLoading} />
        <StatCard label="Milk delivered" value={formatLiters(liters, 1)} icon={Milk} tone="primary" loading={isLoading} />
        <StatCard label="Cash collected" value={formatCurrency(cash)} icon={Banknote} tone="warning" loading={isLoading} />
        <StatCard label="Avg. trip time" value={avg ? formatDuration(avg) : "—"} icon={Timer} tone="info" loading={isLoading} />
      </div>
      <Card>
        <CardContent className="p-5 sm:p-6">
          {isLoading ? (
            <ListSkeleton />
          ) : error ? (
            <ErrorState error={error} onRetry={() => refetch()} />
          ) : data.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="No deliveries in this period" description="Try a wider date range." compact />
          ) : (
            <ResponsiveTable>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Delivered</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead className="text-right">Milk</TableHead>
                    <TableHead className="text-right">Payment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="whitespace-nowrap">{formatDateTime(o.delivered_at)}</TableCell>
                      <TableCell className="font-medium">{o.customer_name}</TableCell>
                      <TableCell className="max-w-[240px] truncate text-muted-foreground">{o.delivery_address}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatLiters(o.quantity)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {o.payment_method === "cash" ? formatCurrency(o.total_amount) : <span className="text-muted-foreground">Prepaid</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ResponsiveTable>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
