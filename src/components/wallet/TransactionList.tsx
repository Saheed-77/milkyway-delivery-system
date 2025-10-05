import { ArrowDownLeft, ArrowUpRight, Receipt } from "lucide-react";
import { EmptyState, ErrorState } from "@/components/common/EmptyState";
import { ListSkeleton } from "@/components/common/Skeletons";
import { useWalletTransactions } from "@/hooks/api/queries";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Wallet history; withdrawals (order payments) and deposits (recharges, refunds, payouts). */
export function TransactionList({ limit = 100 }: { limit?: number }) {
  const { data = [], isLoading, error, refetch } = useWalletTransactions(limit);

  if (isLoading) return <ListSkeleton rows={5} />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (data.length === 0)
    return <EmptyState icon={Receipt} title="No transactions yet" description="Recharges, payments and refunds will appear here." compact />;

  return (
    <ul className="divide-y">
      {data.map((t) => {
        const credit = t.transaction_type === "deposit";
        return (
          <li key={t.id} className="flex items-center gap-3 py-3">
            <span
              className={cn(
                "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                credit ? "bg-success-soft text-success" : "bg-muted text-muted-foreground"
              )}
            >
              {credit ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{t.description ?? (credit ? "Deposit" : "Payment")}</p>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(t.created_at)}
                {t.status !== "completed" && ` · ${t.status}`}
              </p>
            </div>
            <p className={cn("font-semibold tabular-nums", credit ? "text-success" : "text-foreground")}>
              {credit ? "+" : "−"}
              {formatCurrency(t.amount)}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
