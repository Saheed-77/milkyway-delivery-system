import type { ReactNode } from "react";
import { MapPin, Wallet, Banknote } from "lucide-react";
import { Card } from "@/components/ui/card";
import { MilkDot } from "@/components/common/Brand";
import { orderDisplayStatus, StatusBadge } from "@/components/common/StatusBadge";
import { formatCurrency, formatDateTime, formatLiters } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Order } from "@/services";

interface OrderCardProps {
  order: Order;
  actions?: ReactNode;
  footer?: ReactNode;
  showCustomer?: boolean;
  className?: string;
}

export function OrderCard({ order, actions, footer, showCustomer, className }: OrderCardProps) {
  return (
    <Card className={cn("p-4 sm:p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={orderDisplayStatus(order)} />
            {order.source === "subscription" && (
              <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">Subscription</span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {formatDateTime(order.created_at)} · #{order.id.slice(-6).toUpperCase()}
          </p>
          {showCustomer && <p className="font-semibold">{order.customer_name}</p>}
        </div>
        <div className="text-right">
          <p className="text-lg font-bold tabular-nums">{formatCurrency(order.total_amount)}</p>
          <p className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
            {order.payment_method === "wallet" ? <Wallet className="h-3 w-3" /> : <Banknote className="h-3 w-3" />}
            {order.payment_method === "wallet" ? "Wallet" : "Cash on delivery"}
          </p>
        </div>
      </div>

      <ul className="mt-3 space-y-1.5">
        {order.items.map((item, i) => (
          <li key={i} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2">
              <MilkDot type={item.milk_type} />
              {item.product_name}
            </span>
            <span className="tabular-nums text-muted-foreground">
              {formatLiters(item.quantity)} × {formatCurrency(item.unit_price)}
            </span>
          </li>
        ))}
      </ul>

      {order.delivery_address && (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="line-clamp-2">{order.delivery_address}</span>
        </p>
      )}

      {footer}
      {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
    </Card>
  );
}
