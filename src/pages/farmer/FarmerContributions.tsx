import { useState } from "react";
import { FileDown, IndianRupee, Milk, XCircle } from "lucide-react";
import { ContributionsTable } from "@/components/collections/ContributionsTable";
import { DateRangePicker } from "@/components/common/DateRangePicker";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useMyContributions, useMyFarm } from "@/hooks/api/queries";
import { sum } from "@/lib/analytics";
import { addDays, formatCurrency, formatCurrencyPdf, formatDate, formatLiters, toLocalISODate } from "@/lib/format";
import { exportTablePdf } from "@/lib/pdf";
import type { DateRange } from "@/services";

export default function FarmerContributions() {
  const [range, setRange] = useState<DateRange | undefined>({ from: toLocalISODate(addDays(new Date(), -29)), to: toLocalISODate() });
  const q = useMyContributions(range);
  const farm = useMyFarm();
  const rows = q.data ?? [];
  const liters = sum(rows, (c) => c.quantity);
  const value = sum(rows, (c) => c.value);
  const rejected = rows.filter((c) => c.quality_rating === 3).length;

  const download = () =>
    exportTablePdf(
      [
        { header: "Date", value: (c) => formatDate(c.contribution_date) },
        { header: "Milk", value: (c) => c.milk_type },
        { header: "Liters", value: (c) => c.quantity, align: "right" },
        { header: "Quality", value: (c) => (c.quality_rating === 1 ? "Good" : c.quality_rating === 2 ? "Average" : c.quality_rating === 3 ? "Rejected" : "-") },
        { header: "Value", value: (c) => formatCurrencyPdf(c.value), align: "right" },
        { header: "Payment", value: (c) => (c.payment_status === "approved" ? "Paid" : c.payment_status === "pending" ? "Requested" : "Unpaid") },
      ],
      rows,
      {
        title: "Milk contribution statement",
        fileName: "milkyway-contributions",
        subtitle: `${farm.data?.name ?? ""} · ${farm.data?.farm_name ?? ""} (Farmer #${farm.data?.farmer_code ?? "-"}) · ${range?.from ? `${formatDate(range.from)} – ${formatDate(range.to)}` : "All dates"}`,
        summary: [
          ["Total milk", `${liters.toFixed(1)} L`],
          ["Value", formatCurrencyPdf(value)],
          ["Rejected", String(rejected)],
        ],
      }
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title="My milk"
        description="Every collection, its quality grade and what it's worth."
        actions={
          <>
            <DateRangePicker value={range} onChange={setRange} placeholder="All time" />
            <Button variant="outline" onClick={download} disabled={!rows.length}>
              <FileDown /> PDF
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Milk supplied" value={formatLiters(liters, 1)} icon={Milk} loading={q.isLoading} />
        <StatCard label="Value" value={formatCurrency(value)} icon={IndianRupee} tone="success" loading={q.isLoading} />
        <StatCard label="Rejected" value={rejected} icon={XCircle} tone={rejected ? "danger" : "muted"} loading={q.isLoading} />
      </div>
      <Card>
        <CardContent className="p-5 sm:p-6">
          <ContributionsTable rows={rows} isLoading={q.isLoading} error={q.error} onRetry={() => q.refetch()} emptyHint="Clear or widen the date filter to see more." />
        </CardContent>
      </Card>
    </div>
  );
}
