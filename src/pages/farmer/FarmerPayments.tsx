import { HandCoins, IndianRupee, Loader2, Receipt } from "lucide-react";
import { EmptyState, ErrorState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { ResponsiveTable } from "@/components/common/ResponsiveTable";
import { ListSkeleton } from "@/components/common/Skeletons";
import { StatCard } from "@/components/common/StatCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMyPayments, usePendingValue, useRequestPayment } from "@/hooks/api/queries";
import { sum } from "@/lib/analytics";
import { formatCurrency, formatDate, formatLiters } from "@/lib/format";

export default function FarmerPayments() {
  const payments = useMyPayments();
  const pending = usePendingValue();
  const request = useRequestPayment();
  const rows = payments.data ?? [];
  const paid = sum(rows.filter((p) => p.status === "approved"), (p) => p.amount);
  const inReview = sum(rows.filter((p) => p.status === "pending"), (p) => p.amount);

  return (
    <div className="space-y-6">
      <PageHeader title="Payments" description="Request payouts for collected milk. Approved payments go straight to your wallet." />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_2fr]">
        <Card className="border-primary/30 bg-primary-soft/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HandCoins className="h-5 w-5 text-primary" /> Ready to request
            </CardTitle>
            <CardDescription>Calculated at the price in effect on each collection day.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-4xl font-extrabold tabular-nums">{formatCurrency(pending.data?.amount)}</p>
              <p className="text-sm text-muted-foreground">for {formatLiters(pending.data?.liters, 1)} of accepted milk</p>
            </div>
            <Button className="w-full" onClick={() => request.mutate()} disabled={request.isPending || !pending.data?.amount}>
              {request.isPending && <Loader2 className="animate-spin" />}
              Request payment
            </Button>
          </CardContent>
        </Card>
        <div className="grid grid-cols-2 content-start gap-3">
          <StatCard label="Paid to date" value={formatCurrency(paid)} icon={IndianRupee} tone="success" loading={payments.isLoading} />
          <StatCard label="In review" value={formatCurrency(inReview)} icon={Receipt} tone="warning" loading={payments.isLoading} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment history</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.isLoading ? (
            <ListSkeleton />
          ) : payments.error ? (
            <ErrorState error={payments.error} onRetry={() => payments.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState icon={Receipt} title="No payments yet" description="Request your first payout once milk has been collected." compact />
          ) : (
            <ResponsiveTable>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Requested</TableHead>
                    <TableHead className="text-right">Milk</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reviewed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{formatDate(p.payment_date)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {p.contribution_count ? `${formatLiters(p.liters, 1)} · ${p.contribution_count} days` : "—"}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(p.amount)}</TableCell>
                      <TableCell>
                        <StatusBadge status={p.status} label={p.status === "approved" ? "Paid" : undefined} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">{p.approved_at ? formatDate(p.approved_at) : "—"}</TableCell>
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
