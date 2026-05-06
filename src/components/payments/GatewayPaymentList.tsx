import { Building2, CreditCard, Receipt, Smartphone, Wallet } from "lucide-react";
import { EmptyState, ErrorState } from "@/components/common/EmptyState";
import { ListSkeleton } from "@/components/common/Skeletons";
import { Badge } from "@/components/ui/badge";
import { useGatewayPayments } from "@/hooks/api/queries";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type { GatewayMethod, GatewayStatus } from "@/services";

const ICON: Record<GatewayMethod, typeof Wallet> = { upi: Smartphone, card: CreditCard, netbanking: Building2, wallet: Wallet };
const STATUS: Record<GatewayStatus, { label: string; variant: "success" | "danger" | "info" | "muted" }> = {
  captured: { label: "Paid", variant: "success" },
  failed: { label: "Failed", variant: "danger" },
  refunded: { label: "Refunded", variant: "info" },
  created: { label: "Pending", variant: "muted" },
};

/** UPI / card / netbanking payments made through the gateway, including failures and refunds. */
export function GatewayPaymentList() {
  const { data = [], isLoading, error, refetch } = useGatewayPayments();
  if (isLoading) return <ListSkeleton rows={4} />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!data.length) return <EmptyState icon={Receipt} title="No online payments yet" description="Top-ups and orders paid by UPI or card show up here." compact />;

  return (
    <ul className="divide-y">
      {data.map((p) => {
        const Icon = p.method ? ICON[p.method] : Receipt;
        const s = STATUS[p.status];
        return (
          <li key={p.gateway_order_id} className="flex items-center gap-3 py-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground">
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {p.purpose === "wallet_topup" ? "Wallet top-up" : "Order payment"} · {p.method_detail ?? "—"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {formatDateTime(p.created_at)} · <span className="font-mono">{p.id}</span>
                {p.status === "failed" && p.failure_reason && ` · ${p.failure_reason}`}
                {p.status === "refunded" && p.refunded_at && ` · refunded ${formatDateTime(p.refunded_at)}`}
              </p>
            </div>
            <div className="text-right">
              <p className="font-semibold tabular-nums">{formatCurrency(p.amount)}</p>
              <Badge variant={s.variant}>{s.label}</Badge>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
