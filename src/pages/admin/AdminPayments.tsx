import { CheckCircle2, FileDown, IndianRupee, Receipt, XCircle } from "lucide-react";
import { InitialsAvatar } from "@/components/common/Brand";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState, ErrorState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { ResponsiveTable } from "@/components/common/ResponsiveTable";
import { ListSkeleton } from "@/components/common/Skeletons";
import { StatCard } from "@/components/common/StatCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAllPayments, useReviewPayment } from "@/hooks/api/queries";
import { sum } from "@/lib/analytics";
import { formatCurrency, formatCurrencyPdf, formatDate, formatLiters, formatRelative } from "@/lib/format";
import { exportTablePdf } from "@/lib/pdf";

export default function AdminPayments() {
  const { data = [], isLoading, error, refetch } = useAllPayments();
  const review = useReviewPayment();
  const pending = data.filter((p) => p.status === "pending");
  const history = data.filter((p) => p.status !== "pending");
  const paidThisMonth = sum(
    history.filter((p) => p.status === "approved" && p.approved_at && new Date(p.approved_at).getMonth() === new Date().getMonth()),
    (p) => p.amount
  );

  const download = () =>
    exportTablePdf(
      [
        { header: "Requested", value: (p) => formatDate(p.payment_date) },
        { header: "Farmer", value: (p) => `${p.farmer_name} (#${p.farmer_code ?? "-"})` },
        { header: "Liters", value: (p) => p.liters, align: "right" },
        { header: "Amount", value: (p) => formatCurrencyPdf(p.amount), align: "right" },
        { header: "Status", value: (p) => p.status },
        { header: "Reviewed", value: (p) => (p.approved_at ? formatDate(p.approved_at) : "-") },
      ],
      data,
      {
        title: "Farmer payments",
        fileName: "milkyway-farmer-payments",
        summary: [
          ["Awaiting review", formatCurrencyPdf(sum(pending, (p) => p.amount))],
          ["Paid this month", formatCurrencyPdf(paidThisMonth)],
        ],
      }
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Farmer payments"
        description="Approving credits the farmer's wallet instantly; rejecting releases their milk to be re-requested."
        actions={
          <Button variant="outline" onClick={download} disabled={!data.length}>
            <FileDown /> PDF
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Awaiting review" value={formatCurrency(sum(pending, (p) => p.amount))} hint={`${pending.length} request(s)`} icon={Receipt} tone="warning" loading={isLoading} />
        <StatCard label="Paid this month" value={formatCurrency(paidThisMonth)} icon={IndianRupee} tone="success" loading={isLoading} />
        <StatCard label="All-time payouts" value={formatCurrency(sum(history.filter((p) => p.status === "approved"), (p) => p.amount))} icon={IndianRupee} loading={isLoading} className="col-span-2 lg:col-span-1" />
      </div>

      {isLoading ? (
        <ListSkeleton />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Needs review</h2>
            {pending.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="All caught up" description="No payment requests are waiting." compact />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {pending.map((p) => (
                  <Card key={p.id}>
                    <CardHeader className="flex-row items-start gap-3 space-y-0">
                      <InitialsAvatar name={p.farmer_name} />
                      <div className="min-w-0 flex-1">
                        <CardTitle className="truncate text-base">{p.farmer_name}</CardTitle>
                        <CardDescription>
                          #{p.farmer_code} · requested {formatRelative(p.created_at)}
                        </CardDescription>
                      </div>
                      <p className="text-xl font-bold tabular-nums">{formatCurrency(p.amount)}</p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        {formatLiters(p.liters, 1)} across {p.contribution_count} collection{p.contribution_count === 1 ? "" : "s"} · avg{" "}
                        {p.liters ? formatCurrency(p.amount / p.liters) : "—"}/L
                      </p>
                      <div className="flex gap-2">
                        <ConfirmDialog
                          trigger={
                            <Button variant="success" className="flex-1">
                              <CheckCircle2 /> Approve
                            </Button>
                          }
                          title={`Pay ${formatCurrency(p.amount)} to ${p.farmer_name}?`}
                          description="The amount is credited to the farmer's MilkyWay wallet immediately."
                          confirmLabel="Approve & credit"
                          onConfirm={() => review.mutateAsync({ id: p.id, approve: true })}
                        />
                        <ConfirmDialog
                          trigger={
                            <Button variant="outline" className="flex-1 text-destructive">
                              <XCircle /> Reject
                            </Button>
                          }
                          title="Reject this payment request?"
                          description="The contributions are released so the farmer can request again after corrections."
                          confirmLabel="Reject"
                          variant="destructive"
                          onConfirm={() => review.mutateAsync({ id: p.id, approve: false })}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <Card>
            <CardHeader>
              <CardTitle>History</CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <EmptyState icon={Receipt} title="No reviewed payments yet" compact />
              ) : (
                <ResponsiveTable>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Requested</TableHead>
                        <TableHead>Farmer</TableHead>
                        <TableHead className="text-right">Milk</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Reviewed</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>{formatDate(p.payment_date)}</TableCell>
                          <TableCell className="font-medium">{p.farmer_name}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatLiters(p.liters, 1)}</TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(p.amount)}</TableCell>
                          <TableCell>
                            <StatusBadge status={p.status} label={p.status === "approved" ? "Paid" : undefined} />
                          </TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(p.approved_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ResponsiveTable>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
