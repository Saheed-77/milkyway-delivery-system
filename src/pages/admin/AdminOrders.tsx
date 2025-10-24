import { useMemo, useState } from "react";
import { CheckCircle2, FileDown, Search, ShoppingBasket, XCircle } from "lucide-react";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DateRangePicker } from "@/components/common/DateRangePicker";
import { EmptyState, ErrorState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { ResponsiveTable } from "@/components/common/ResponsiveTable";
import { ListSkeleton } from "@/components/common/Skeletons";
import { orderDisplayStatus, StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAllOrders, useAssignOrder, useCancelOrder, useForceComplete, useRiders } from "@/hooks/api/queries";
import { sum } from "@/lib/analytics";
import { addDays, formatCurrency, formatCurrencyPdf, formatDateTime, formatLiters, toLocalISODate } from "@/lib/format";
import { exportTablePdf } from "@/lib/pdf";
import type { DateRange, Order, OrderStatus } from "@/services";

const TABS: { value: OrderStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "out_for_delivery", label: "On the way" },
  { value: "completed", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

function RiderCell({ order }: { order: Order }) {
  const riders = useRiders();
  const assign = useAssignOrder();
  if (order.status !== "pending") return <span className="text-sm">{order.rider_name ?? "—"}</span>;
  return (
    <Select
      value={order.delivery_person_id ?? "none"}
      disabled={assign.isPending}
      onValueChange={(v) => assign.mutate({ orderId: order.id, riderId: v === "none" ? null : v })}
    >
      <SelectTrigger className="h-8 w-[150px] text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Unassigned</SelectItem>
        {riders.data?.map((r) => (
          <SelectItem key={r.id} value={r.id}>
            {r.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function AdminOrders() {
  const [status, setStatus] = useState<OrderStatus | "all">("all");
  const [range, setRange] = useState<DateRange | undefined>({ from: toLocalISODate(addDays(new Date(), -6)), to: toLocalISODate() });
  const [query, setQuery] = useState("");
  const q = useAllOrders(status, range);
  const complete = useForceComplete();
  const cancel = useCancelOrder();

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (q.data ?? []).filter(
      (o) => !term || `${o.customer_name} ${o.delivery_address ?? ""} ${o.id} ${o.rider_name ?? ""}`.toLowerCase().includes(term)
    );
  }, [q.data, query]);

  const revenue = sum(rows.filter((o) => o.status !== "cancelled"), (o) => o.total_amount);

  const download = () =>
    exportTablePdf(
      [
        { header: "Placed", value: (o: Order) => formatDateTime(o.created_at) },
        { header: "Order", value: (o) => `#${o.id.slice(-6).toUpperCase()}` },
        { header: "Customer", value: (o) => o.customer_name },
        { header: "Milk", value: (o) => `${o.quantity} L` },
        { header: "Amount", value: (o) => formatCurrencyPdf(o.total_amount), align: "right" },
        { header: "Payment", value: (o) => o.payment_method },
        { header: "Status", value: (o) => o.status.replace(/_/g, " ") },
        { header: "Rider", value: (o) => o.rider_name ?? "-" },
      ],
      rows,
      {
        title: "Orders report",
        fileName: "milkyway-orders",
        orientation: "landscape",
        summary: [
          ["Orders", String(rows.length)],
          ["Revenue", formatCurrencyPdf(revenue)],
          ["Liters", `${sum(rows, (o) => o.quantity)} L`],
        ],
      }
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        description={`${rows.length} orders · ${formatCurrency(revenue)} revenue in view`}
        actions={
          <Button variant="outline" onClick={download} disabled={!rows.length}>
            <FileDown /> Export PDF
          </Button>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={status} onValueChange={(v) => setStatus(v as OrderStatus | "all")}>
          <TabsList className="h-auto flex-wrap justify-start">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search customer, area, rider" className="w-60 pl-9" />
          </div>
          <DateRangePicker value={range} onChange={setRange} />
        </div>
      </div>

      <Card>
        <CardContent className="p-5 sm:p-6">
          {q.isLoading ? (
            <ListSkeleton />
          ) : q.error ? (
            <ErrorState error={q.error} onRetry={() => q.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState icon={ShoppingBasket} title="No orders match" description="Change the status, search or date filters." compact />
          ) : (
            <ResponsiveTable>
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Placed</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Rider</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatDateTime(o.created_at)}
                        <div className="font-mono text-[11px] text-muted-foreground">#{o.id.slice(-6).toUpperCase()}</div>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{o.customer_name}</p>
                        <p className="max-w-[200px] truncate text-xs text-muted-foreground">{o.delivery_address}</p>
                      </TableCell>
                      <TableCell className="text-sm">
                        {o.items.map((i) => `${formatLiters(i.quantity)} ${i.milk_type}`).join(", ")}
                        {o.source === "subscription" && <div className="text-[11px] text-info">subscription</div>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(o.total_amount)}
                        <div className="text-[11px] text-muted-foreground">{o.payment_method === "cash" ? "cash" : "wallet"}</div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={orderDisplayStatus(o)} />
                      </TableCell>
                      <TableCell>
                        <RiderCell order={o} />
                      </TableCell>
                      <TableCell className="text-right">
                        {(o.status === "pending" || o.status === "out_for_delivery") && (
                          <div className="flex justify-end gap-1">
                            <ConfirmDialog
                              trigger={
                                <Button size="icon-sm" variant="ghost" aria-label="Mark delivered">
                                  <CheckCircle2 className="text-success" />
                                </Button>
                              }
                              title="Mark as delivered without OTP?"
                              description="Use this only when delivery was confirmed another way (e.g. a phone call)."
                              confirmLabel="Mark delivered"
                              onConfirm={() => complete.mutateAsync(o.id)}
                            />
                            {o.status === "pending" && (
                              <ConfirmDialog
                                trigger={
                                  <Button size="icon-sm" variant="ghost" aria-label="Cancel order">
                                    <XCircle className="text-destructive" />
                                  </Button>
                                }
                                title="Cancel this order?"
                                description={
                                  o.payment_method === "wallet"
                                    ? `${formatCurrency(o.total_amount)} is refunded to ${o.customer_name}'s wallet and the milk returns to stock.`
                                    : "The milk returns to stock."
                                }
                                confirmLabel="Cancel order"
                                variant="destructive"
                                onConfirm={() => cancel.mutateAsync(o.id)}
                              />
                            )}
                          </div>
                        )}
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
