import { Link } from "react-router-dom";
import { ArrowRight, Bike, IndianRupee, Map, Milk, ShoppingBasket, UserCheck, Users } from "lucide-react";
import { StockPanel } from "@/components/admin/StockPanel";
import { TrendChart } from "@/components/charts/TrendChart";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { orderDisplayStatus, StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAllPayments, useFarmers, useReportDataset, useRiders } from "@/hooks/api/queries";
import { dailyBuckets, sum, windowSum } from "@/lib/analytics";
import { formatCurrency, formatLiters, formatRelative, percentChange } from "@/lib/format";

export default function AdminOverview() {
  const data = useReportDataset(14);
  const riders = useRiders();
  const farmers = useFarmers();
  const payments = useAllPayments();

  const orders = (data.data?.orders ?? []).filter((o) => o.status !== "cancelled");
  const contributions = data.data?.contributions ?? [];
  const revToday = windowSum(orders, (o) => o.created_at, (o) => o.total_amount, 1, 0);
  const revYesterday = windowSum(orders, (o) => o.created_at, (o) => o.total_amount, 2, 1);
  const ordToday = windowSum(orders, (o) => o.created_at, () => 1, 1, 0);
  const ordYesterday = windowSum(orders, (o) => o.created_at, () => 1, 2, 1);
  const collectedToday = windowSum(contributions, (c) => c.contribution_date, (c) => c.quantity, 1, 0);
  const collectedYesterday = windowSum(contributions, (c) => c.contribution_date, (c) => c.quantity, 2, 1);
  const activeRiders = (riders.data ?? []).filter((r) => r.active_orders > 0).length;

  const series = dailyBuckets(14, orders, (o) => o.created_at, { revenue: (o) => o.total_amount, orders: () => 1 });
  const supply = dailyBuckets(14, [...contributions.map((c) => ({ d: c.contribution_date, in: c.quantity, out: 0 })), ...orders.map((o) => ({ d: o.created_at, in: 0, out: o.quantity }))], (r) => r.d, {
    collected: (r) => r.in,
    sold: (r) => r.out,
  });

  const unassigned = (data.data?.orders ?? []).filter((o) => o.status === "pending" && !o.delivery_person_id);
  const pendingFarmers = (farmers.data ?? []).filter((f) => f.status === "pending");
  const pendingPayments = (payments.data ?? []).filter((p) => p.status === "pending");
  const recent = [...(data.data?.orders ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 6);

  const tasks = [
    { n: unassigned.length, label: "orders waiting for a rider", to: "/dashboard/admin/live", icon: Map },
    { n: pendingPayments.length, label: `farmer payments to review (${formatCurrency(sum(pendingPayments, (p) => p.amount))})`, to: "/dashboard/admin/payments", icon: IndianRupee },
    { n: pendingFarmers.length, label: "farmer registrations to approve", to: "/dashboard/admin/farmers", icon: UserCheck },
  ].filter((t) => t.n > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Good to see you"
        description="Today's orders, supply and deliveries in one place."
        actions={
          <Button asChild>
            <Link to="/dashboard/admin/live">
              <Map /> Open Live Ops
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Revenue today" value={formatCurrency(revToday)} trend={percentChange(revToday, revYesterday)} hint="vs yesterday" icon={IndianRupee} loading={data.isLoading} />
        <StatCard label="Orders today" value={ordToday} trend={percentChange(ordToday, ordYesterday)} hint="vs yesterday" icon={ShoppingBasket} tone="info" loading={data.isLoading} />
        <StatCard label="Milk collected" value={formatLiters(collectedToday, 0)} trend={percentChange(collectedToday, collectedYesterday)} hint="today" icon={Milk} tone="success" loading={data.isLoading} />
        <StatCard
          label="Riders on duty"
          value={`${activeRiders}/${riders.data?.length ?? 0}`}
          hint={`${sum(riders.data ?? [], (r) => r.completed_today)} delivered today`}
          icon={Bike}
          tone="warning"
          loading={riders.isLoading}
        />
      </div>

      {tasks.length > 0 && (
        <Card>
          <CardContent className="divide-y p-0">
            {tasks.map((t) => (
              <Link key={t.to} to={t.to} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/50">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-warning-soft text-warning">
                  <t.icon className="h-4 w-4" />
                </span>
                <p className="flex-1 text-sm">
                  <strong>{t.n}</strong> {t.label}
                </p>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Revenue — last 14 days</CardTitle>
            <CardDescription>Excludes cancelled orders</CardDescription>
          </CardHeader>
          <CardContent>
            <TrendChart data={series} config={{ revenue: { label: "Revenue", color: "hsl(var(--chart-1))" } }} valueFormatter={(v) => formatCurrency(v)} yWidth={56} />
          </CardContent>
        </Card>
        <StockPanel compact />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Supply vs. demand</CardTitle>
            <CardDescription>Liters collected from farmers vs. sold to customers</CardDescription>
          </CardHeader>
          <CardContent>
            <TrendChart
              type="bar"
              legend
              data={supply}
              config={{
                collected: { label: "Collected", color: "hsl(var(--chart-1))" },
                sold: { label: "Sold", color: "hsl(var(--chart-2))" },
              }}
              valueFormatter={(v) => formatLiters(v)}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Latest orders</CardTitle>
            <Button size="sm" variant="ghost" asChild>
              <Link to="/dashboard/admin/orders">
                All <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-1 p-3">
            {recent.map((o) => (
              <div key={o.id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted/50">
                <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{o.customer_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatLiters(o.quantity)} · {formatRelative(o.created_at)}
                  </p>
                </div>
                <StatusBadge status={orderDisplayStatus(o)} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
