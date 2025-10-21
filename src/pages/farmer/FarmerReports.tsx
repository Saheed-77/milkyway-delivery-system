import { useState } from "react";
import { CalendarRange, IndianRupee, Milk, TrendingUp } from "lucide-react";
import { TrendChart } from "@/components/charts/TrendChart";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMyContributions } from "@/hooks/api/queries";
import { weeklyBuckets } from "@/lib/analytics";
import { addDays, formatCurrency, formatLiters, percentChange, toLocalISODate } from "@/lib/format";

export default function FarmerReports() {
  const [weeks, setWeeks] = useState(8);
  const q = useMyContributions({ from: toLocalISODate(addDays(new Date(), -weeks * 7 - 7)) });
  const data = weeklyBuckets(weeks, q.data ?? [], (c) => c.contribution_date, {
    liters: (c) => c.quantity,
    earnings: (c) => c.value,
  });
  const cur = data[data.length - 1];
  const prev = data[data.length - 2];
  const best = data.reduce((m, p) => ((p.liters as number) > (m?.liters as number) ? p : m), data[0]);
  const curL = Number(cur?.liters ?? 0);
  const prevL = Number(prev?.liters ?? 0);
  const curE = Number(cur?.earnings ?? 0);
  const prevE = Number(prev?.earnings ?? 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Weekly reports"
        description="Week-over-week milk and earnings (weeks start on Monday)."
        actions={
          <Tabs value={String(weeks)} onValueChange={(v) => setWeeks(Number(v))}>
            <TabsList>
              <TabsTrigger value="4">4 weeks</TabsTrigger>
              <TabsTrigger value="8">8 weeks</TabsTrigger>
              <TabsTrigger value="12">12 weeks</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* percentChange returns null (shown as "new") instead of a fake +100% when last week was 0 */}
        <StatCard label="This week" value={formatLiters(curL, 1)} trend={percentChange(curL, prevL)} icon={Milk} loading={q.isLoading} />
        <StatCard label="Earned this week" value={formatCurrency(curE)} trend={percentChange(curE, prevE)} icon={IndianRupee} tone="success" loading={q.isLoading} />
        <StatCard label="Best week" value={best ? formatLiters(Number(best.liters), 0) : "—"} hint={best ? `w/c ${best.label}` : undefined} icon={TrendingUp} tone="info" loading={q.isLoading} />
        <StatCard
          label="Weekly average"
          value={formatLiters(data.reduce((s, p) => s + Number(p.liters), 0) / Math.max(1, data.length), 0)}
          icon={CalendarRange}
          tone="warning"
          loading={q.isLoading}
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Milk supplied</CardTitle>
            <CardDescription>Liters accepted per week</CardDescription>
          </CardHeader>
          <CardContent>
            <TrendChart type="bar" data={data} config={{ liters: { label: "Liters", color: "hsl(var(--chart-1))" } }} valueFormatter={(v) => formatLiters(v)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Earnings</CardTitle>
            <CardDescription>Value at date-effective prices</CardDescription>
          </CardHeader>
          <CardContent>
            <TrendChart
              type="bar"
              data={data}
              config={{ earnings: { label: "Earnings", color: "hsl(var(--chart-2))" } }}
              valueFormatter={(v) => formatCurrency(v)}
              yWidth={56}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
