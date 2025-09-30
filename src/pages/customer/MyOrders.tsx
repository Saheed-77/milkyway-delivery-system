import { useState } from "react";
import { Link } from "react-router-dom";
import { MapPinned, Package, ShoppingBasket, XCircle } from "lucide-react";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState, ErrorState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { ListSkeleton } from "@/components/common/Skeletons";
import { OrderCard } from "@/components/orders/OrderCard";
import { OrderTimeline } from "@/components/orders/OrderTimeline";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCancelOrder, useMyOrders } from "@/hooks/api/queries";
import { formatCurrency } from "@/lib/format";

type Filter = "active" | "past" | "all";

export default function MyOrders() {
  const { data = [], isLoading, error, refetch } = useMyOrders();
  const cancel = useCancelOrder();
  const [filter, setFilter] = useState<Filter>("active");

  const isActive = (s: string) => s === "pending" || s === "out_for_delivery";
  const rows = data.filter((o) => (filter === "all" ? true : filter === "active" ? isActive(o.status) : !isActive(o.status)));
  const activeCount = data.filter((o) => isActive(o.status)).length;
  const spent = data.filter((o) => o.status === "completed").reduce((s, o) => s + o.total_amount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My orders"
        description={`${data.length} orders · ${formatCurrency(spent)} of fresh milk delivered`}
        actions={
          <Button asChild>
            <Link to="/dashboard/customer">
              <ShoppingBasket /> New order
            </Link>
          </Button>
        }
      />

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <TabsList>
          <TabsTrigger value="active">Active{activeCount ? ` (${activeCount})` : ""}</TabsTrigger>
          <TabsTrigger value="past">Past</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Package}
          title={filter === "active" ? "No active orders" : "No orders yet"}
          description="Your fresh milk orders will show up here."
          action={
            <Button asChild variant="soft">
              <Link to="/dashboard/customer">Order milk</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              footer={
                isActive(order.status) && (
                  <div className="mt-4 space-y-3 rounded-xl bg-muted/60 p-3">
                    <OrderTimeline order={order} />
                    {order.delivery_otp && (
                      <p className="text-center text-sm">
                        Share code <span className="rounded-md bg-card px-2 py-0.5 font-mono text-base font-bold tracking-widest">{order.delivery_otp}</span> with your rider
                      </p>
                    )}
                  </div>
                )
              }
              actions={
                isActive(order.status) && (
                  <>
                    <Button asChild size="sm">
                      <Link to={`/dashboard/customer/track/${order.id}`}>
                        <MapPinned /> Track
                      </Link>
                    </Button>
                    {order.status === "pending" && (
                      <ConfirmDialog
                        trigger={
                          <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive-soft hover:text-destructive">
                            <XCircle /> Cancel
                          </Button>
                        }
                        title="Cancel this order?"
                        description={
                          order.payment_method === "wallet"
                            ? `${formatCurrency(order.total_amount)} will be refunded to your wallet immediately.`
                            : "The rider will be notified that this stop is cancelled."
                        }
                        confirmLabel="Cancel order"
                        cancelLabel="Keep order"
                        variant="destructive"
                        onConfirm={() => cancel.mutateAsync(order.id)}
                      />
                    )}
                  </>
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
