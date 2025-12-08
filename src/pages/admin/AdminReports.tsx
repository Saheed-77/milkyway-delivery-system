import { useState } from "react";
import { Cell, Pie, PieChart } from "recharts";
import { IndianRupee, Milk, Repeat, ShoppingBasket, Timer, UserPlus } from "lucide-react";
import { TrendChart } from "@/components/charts/TrendChart";
import { ErrorState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { PageSkeleton } from "@/components/common/Skeletons";
import { StatCard } from "@/components/common/StatCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useReportDataset } from "@/hooks/api/queries";
import { countBy, dailyBuckets, sum, weeklyBuckets } from "@/lib/analytics";
import { formatCurrency, formatDuration, formatLiters } from "@/lib/format";

const STATUS_COLORS: Record<string, string> = {
  completed: "hsl(var(--chart-1))",
  out_for_delivery: "hsl(var(--chart-2))",
  pending: "hsl(var(--chart-3))",
  cancelled: "hsl(var(--chart-4))",
};
const STATUS_LABEL: Record<string, string> = {
  completed: "Delivered",
  out_for_delivery: "On the way",
  pending: "Pending",
  cancelled: "Cancelled",
};

export default function AdminReports() {
  const [days, setDays] = useState(30);
  const { data, isLoading, error, refetch } = useReportDataset(days);

  if (isLoading) return <PageSkeleton />;
  if (error || !data) return <ErrorState error={error} onRetry={() => refetch()} />;

  // All series come from real data — the old page plotted hardcoded mock numbers.
  const valid = data.orders.filter((o) => o.status !== "cancelled");
  const revenue = sum(valid, (o) => o.total_amount);
  const liters = sum(valid, (o) => o.quantity);
  const collected = sum(data.contributions, (c) => c.quantity);
  const subShare = valid.length ? (valid.filter((o) => o.source === "subscription").length / valid.length) * 100 : 0;
  const times = data.orders
    .filter((o) => o.delivered_at)
    .map((o) => (new Date(o.delivered_at!).getTime() - new Date(o.created_at).getTime()) / 1000);
  const avgFulfil = times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0;

  const daily = dailyBuckets(days, valid, (o) => o.created_at, {
    wallet: (o) => (o.payment_method === "wallet" ? o.total_amount : 0),
    cash: (o) => (o.payment_method === "cash" ? o.total_amount : 0),
  });
  const flow = dailyBuckets(
    days,
    [...data.contributions.map((c) => ({ d: c.contribution_date, i: c.quantity, o: 0 })), ...valid.map((o) => ({ d: o.created_at, i: 0, o: o.quantity }))],
    (r) => r.d,
    { collected: (r) => r.i, sold: (r) => r.o }
  );
  const signups = weeklyBuckets(Math.max(4, Math.round(days / 7)), data.signups, (s) => s.created_at, {
    customer: (s) => (s.user_type === "customer" ? 1 : 0),
    farmer: (s) => (s.user_type === "farmer" ? 1 : 0),
  });
  const byStatus = Object.entries(countBy(data.orders, (o) => o.status)).map(([status, value]) => ({ status, value, fill: STATUS_COLORS[status] }));
  const topCustomers = Object.values(
    valid.reduce<Record<string, { name: string; total: number; orders: number }>>((acc, o) => {
      acc[o.customer_id] ??= { name: o.customer_name, total: 0, orders: 0 };
      acc[o.customer_id]!.total += o.total_amount;
      acc[o.customer_id]!.orders += 1;
      return acc;
    }, {})
  )
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Sales, supply and growth from live data."
        actions={
          <Tabs value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <TabsList>
              <TabsTrigger value="7">7 days</TabsTrigger>
              <TabsTrigger value="30">30 days</TabsTrigger>
              <TabsTrigger value="90">90 days</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
        <StatCard label="Revenue" value={formatCurrency(revenue)} icon={IndianRupee} />
        <StatCard label="Orders" value={valid.length} icon={ShoppingBasket} tone="info" />
        <StatCard label="Milk sold" value={formatLiters(liters, 0)} icon={Milk} tone="success" />
        <StatCard label="Milk collected" value={formatLiters(collected, 0)} icon={Milk} tone="primary" />
        <StatCard label="From subscriptions" value={`${subShare.toFixed(0)}%`} icon={Repeat} tone="warning" />
        <StatCard label="Avg. order → door" value={avgFulfil ? formatDuration(avgFulfil) : "—"} icon={Timer} tone="muted" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daily revenue</CardTitle>
          <CardDescription>Split by payment method</CardDescription>
        </CardHeader>
        <CardContent>
          <TrendChart
            type="bar"
            stacked
            legend
            data={daily}
            config={{ wallet: { label: "Wallet", color: "hsl(var(--chart-1))" }, cash: { label: "Cash", color: "hsl(var(--chart-3))" } }}
            valueFormatter={(v) => formatCurrency(v)}
            yWidth={56}
            className="h-72"
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Milk flow</CardTitle>
            <CardDescription>Collected from farmers vs. sold to customers (liters)</CardDescription>
          </CardHeader>
          <CardContent>
            <TrendChart
              legend
              data={flow}
              config={{ collected: { label: "Collected", color: "hsl(var(--chart-1))" }, sold: { label: "Sold", color: "hsl(var(--chart-2))" } }}
              valueFormatter={(v) => formatLiters(v)}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Order outcomes</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={Object.fromEntries(byStatus.map((s) => [s.status, { label: STATUS_LABEL[s.status] ?? s.status, color: s.fill }]))}
              className="mx-auto aspect-square h-60"
            >
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent nameKey="status" hideLabel />} />
                <Pie data={byStatus} dataKey="value" nameKey="status" innerRadius={55} strokeWidth={4}>
                  {byStatus.map((s) => (
                    <Cell key={s.status} fill={s.fill} />
                  ))}
                </Pie>
                <ChartLegend content={<ChartLegendContent nameKey="status" />} className="flex-wrap" />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" /> New sign-ups per week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart
              type="bar"
              legend
              data={signups}
              config={{ customer: { label: "Customers", color: "hsl(var(--chart-2))" }, farmer: { label: "Farmers", color: "hsl(var(--chart-1))" } }}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top customers</CardTitle>
            <CardDescription>By spend in this period</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {topCustomers.map((c, i) => (
                <li key={c.name} className="flex items-center gap-3">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary">{i + 1}</span>
                  <span className="flex-1 font-medium">{c.name}</span>
                  <span className="text-sm text-muted-foreground">{c.orders} orders</span>
                  <span className="w-24 text-right font-semibold tabular-nums">{formatCurrency(c.total)}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
