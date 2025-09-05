import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { AccountStatus, OrderStatus, PaymentStatus, SubscriptionStatus } from "@/services";

type AnyStatus = OrderStatus | PaymentStatus | AccountStatus | SubscriptionStatus | "assigned";

const MAP: Record<string, { label: string; variant: BadgeProps["variant"]; dot: string }> = {
  pending: { label: "Pending", variant: "warning", dot: "bg-warning" },
  assigned: { label: "Assigned", variant: "info", dot: "bg-info" },
  out_for_delivery: { label: "On the way", variant: "info", dot: "bg-info animate-pulse" },
  completed: { label: "Delivered", variant: "success", dot: "bg-success" },
  cancelled: { label: "Cancelled", variant: "muted", dot: "bg-muted-foreground" },
  approved: { label: "Approved", variant: "success", dot: "bg-success" },
  rejected: { label: "Rejected", variant: "danger", dot: "bg-destructive" },
  active: { label: "Active", variant: "success", dot: "bg-success" },
  paused: { label: "Paused", variant: "warning", dot: "bg-warning" },
};

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: AnyStatus;
  /** Override the default label (e.g. "Blacklisted" for rejected farmers). */
  label?: string;
  className?: string;
}) {
  const s = MAP[status] ?? { label: status, variant: "muted" as const, dot: "bg-muted-foreground" };
  return (
    <Badge variant={s.variant} className={className}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden />
      {label ?? s.label}
    </Badge>
  );
}

/** Pending orders with a rider are shown as "Assigned". */
export const orderDisplayStatus = (o: { status: OrderStatus; delivery_person_id: string | null }): AnyStatus =>
  o.status === "pending" && o.delivery_person_id ? "assigned" : o.status;
