import { Bike, Check, ClipboardCheck, PackageCheck, ShoppingBag, XCircle } from "lucide-react";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Order } from "@/services";

interface Step {
  key: string;
  label: string;
  icon: typeof Check;
  at: string | null;
}

/** Placed → Assigned → On the way → Delivered, with timestamps. */
export function OrderTimeline({ order, className }: { order: Order; className?: string }) {
  if (order.status === "cancelled") {
    return (
      <div className={cn("flex items-center gap-3 rounded-xl bg-muted p-3 text-sm", className)}>
        <XCircle className="h-5 w-5 text-muted-foreground" />
        This order was cancelled{order.payment_method === "wallet" ? " and refunded to your wallet" : ""}.
      </div>
    );
  }

  const steps: Step[] = [
    { key: "placed", label: "Order placed", icon: ShoppingBag, at: order.created_at },
    { key: "assigned", label: order.rider_name ? `${order.rider_name.split(" ")[0]} assigned` : "Rider assigned", icon: ClipboardCheck, at: order.assigned_at },
    { key: "out", label: "On the way", icon: Bike, at: order.picked_up_at },
    { key: "done", label: "Delivered", icon: PackageCheck, at: order.delivered_at },
  ];
  const reached = [
    true,
    !!order.delivery_person_id || order.status !== "pending",
    order.status === "out_for_delivery" || order.status === "completed",
    order.status === "completed",
  ];
  const current = reached.lastIndexOf(true);

  return (
    <ol className={cn("relative grid grid-cols-4 gap-1", className)} aria-label="Delivery progress">
      {steps.map((s, i) => {
        const done = reached[i];
        const isCurrent = i === current && order.status !== "completed";
        const Icon = done && !isCurrent ? Check : s.icon;
        return (
          <li key={s.key} className="relative flex flex-col items-center text-center">
            {i > 0 && (
              <span
                className={cn("absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2", reached[i] ? "bg-primary" : "bg-border")}
                aria-hidden
              />
            )}
            <span
              className={cn(
                "relative z-10 grid h-8 w-8 place-items-center rounded-full border-2 transition-colors",
                done ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground",
                isCurrent && "ring-4 ring-primary/20"
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span className={cn("mt-2 text-[11px] font-semibold leading-tight sm:text-xs", !done && "text-muted-foreground")}>{s.label}</span>
            <span className="text-[10px] text-muted-foreground sm:text-[11px]">{done && s.at ? formatTime(s.at) : "—"}</span>
          </li>
        );
      })}
    </ol>
  );
}
