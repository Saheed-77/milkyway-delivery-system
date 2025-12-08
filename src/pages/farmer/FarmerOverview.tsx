import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck, CalendarDays, IndianRupee, Loader2, Milk, Sprout, Wallet } from "lucide-react";
import { TrendChart } from "@/components/charts/TrendChart";
import { ContributionsTable } from "@/components/collections/ContributionsTable";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMyContributions, useMyFarm, useMyPayments, usePendingValue, useRequestPayment, useWalletBalance } from "@/hooks/api/queries";
import { dailyBuckets, sum, windowSum } from "@/lib/analytics";
import { addDays, formatCurrency, formatLiters, percentChange, toLocalISODate } from "@/lib/format";

export default function FarmerOverview() {
  const farm = useMyFarm();
  const contributions = useMyContributions({ from: toLocalISODate(addDays(new Date(), -27)) });
  const pending = usePendingValue();
  const payments = useMyPayments();
  const balance = useWalletBalance();
  const request = useRequestPayment();

  const rows = contributions.data ?? [];
  const thisWeek = windowSum(rows, (c) => c.contribution_date, (c) => c.quantity, 7, 0);
  const lastWeek = windowSum(rows, (c) => c.contribution_date, (c) => c.quantity, 14, 7);
  const accepted = rows.filter((c) => c.quality_rating && c.quality_rating < 3).length;
  const graded = rows.filter((c) => c.quality_rating).length;
  // previously only the last 5 payments were summed
  const totalPaid = sum((payments.data ?? []).filter((p) => p.status === "approved"), (p) => p.amount);
  const awaiting = (payments.data ?? []).filter((p) => p.status === "pending");
  const chart = dailyBuckets(14, rows, (c) => c.contribution_date, { liters: (c) => c.quantity, earnings: (c) => c.value });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={farm.data ? `Farmer ID #${farm.data.farmer_code}` : "Farmer"}
        title={farm.data?.farm_name ?? "Your farm"}
        description="Your milk, quality and earnings at a glance."
        actions={
          <Button
            onClick={() => request.mutate()}
            disabled={request.isPending || !pending.data || pending.data.amount <= 0}
          >
            {request.isPending ? <Loader2 className="animate-spin" /> : <IndianRupee />}
            Request {pending.data?.amount ? formatCurrency(pending.data.amount) : "payment"}
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Unpaid earnings"
          value={formatCurrency(pending.data?.amount)}
          hint={`${formatLiters(pending.data?.liters, 1)} not yet requested`}
          icon={IndianRupee}
          tone="primary"
          loading={pending.isLoading}
        />
        <StatCard label="This week" value={formatLiters(thisWeek, 1)} trend={percentChange(thisWeek, lastWeek)} hint="vs last week" icon={Milk} tone="info" loading={contributions.isLoading} />
        <StatCard
          label="Quality pass rate"
          value={graded ? `${Math.round((accepted / graded) * 100)}%` : "—"}
          hint="last 4 weeks"
          icon={BadgeCheck}
          tone="success"
          loading={contributions.isLoading}
        />
        <StatCard label="Wallet" value={formatCurrency(balance.data)} hint={`${formatCurrency(totalPaid)} paid to date`} icon={Wallet} tone="warning" loading={balance.isLoading} />
      </div>

      {awaiting.length > 0 && (
        <Card className="border-warning/40 bg-warning-soft/50">
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <CalendarDays className="h-5 w-5 text-warning" />
            <p className="flex-1 text-sm">
              <strong>{formatCurrency(sum(awaiting, (p) => p.amount))}</strong> requested and awaiting admin review.
            </p>
            <Button size="sm" variant="ghost" asChild>
              <Link to="/dashboard/farmer/payments">
                View <ArrowRight />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Last 14 days</CardTitle>
            <CardDescription>Liters accepted per day</CardDescription>
          </CardHeader>
          <CardContent>
            <TrendChart
              data={chart}
              config={{ liters: { label: "Liters", color: "hsl(var(--chart-1))" } }}
              valueFormatter={(v) => formatLiters(v)}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sprout className="h-5 w-5 text-primary" /> Tips for better pay
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Chill milk to under 4 °C within two hours of milking — it's the biggest factor in a “Good” grade.</p>
            <p>Three substandard submissions in a row pause your account, so flag sick animals early.</p>
            <p>Payments use the price in effect on each collection day, so you never lose out when rates change.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Recent collections</CardTitle>
          <Button size="sm" variant="ghost" asChild>
            <Link to="/dashboard/farmer/contributions">
              All history <ArrowRight />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <ContributionsTable rows={rows.slice(0, 7)} isLoading={contributions.isLoading} error={contributions.error} onRetry={() => contributions.refetch()} />
        </CardContent>
      </Card>
    </div>
  );
}
