import { useState } from "react";
import { FileDown } from "lucide-react";
import { StockPanel } from "@/components/admin/StockPanel";
import { CollectionForm } from "@/components/collections/CollectionForm";
import { ContributionsTable } from "@/components/collections/ContributionsTable";
import { DateRangePicker } from "@/components/common/DateRangePicker";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAllContributions } from "@/hooks/api/queries";
import { sum } from "@/lib/analytics";
import { addDays, formatCurrencyPdf, formatDate, formatLiters, toLocalISODate } from "@/lib/format";
import { exportTablePdf } from "@/lib/pdf";
import type { DateRange } from "@/services";

export default function AdminCollections() {
  const [range, setRange] = useState<DateRange | undefined>({ from: toLocalISODate(addDays(new Date(), -6)), to: toLocalISODate() });
  const q = useAllContributions(range);
  const rows = q.data ?? [];

  const download = () =>
    exportTablePdf(
      [
        { header: "Date", value: (c) => formatDate(c.contribution_date) },
        { header: "Farmer", value: (c) => `${c.farmer_name} (#${c.farmer_code ?? "-"})` },
        { header: "Milk", value: (c) => c.milk_type },
        { header: "Liters", value: (c) => c.quantity, align: "right" },
        { header: "Grade", value: (c) => (c.quality_rating === 1 ? "Good" : c.quality_rating === 2 ? "Average" : c.quality_rating === 3 ? "Rejected" : "-") },
        { header: "Value", value: (c) => formatCurrencyPdf(c.value), align: "right" },
      ],
      rows,
      {
        title: "Milk collections",
        fileName: "milkyway-collections",
        subtitle: range?.from ? `${formatDate(range.from)} – ${formatDate(range.to)}` : "All dates",
        summary: [
          ["Collections", String(rows.length)],
          ["Liters", `${sum(rows, (c) => c.quantity).toFixed(1)} L`],
          ["Value", formatCurrencyPdf(sum(rows, (c) => c.value))],
        ],
      }
    );

  return (
    <div className="space-y-6">
      <PageHeader title="Collections" description="Record farmer deliveries and review everything collected." />
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <CollectionForm />
        <StockPanel />
      </div>
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <CardTitle>
            Collection log · <span className="text-primary">{formatLiters(sum(rows, (c) => c.quantity), 1)}</span>
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <DateRangePicker value={range} onChange={setRange} />
            <Button variant="outline" onClick={download} disabled={!rows.length}>
              <FileDown /> PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ContributionsTable rows={rows} isLoading={q.isLoading} error={q.error} onRetry={() => q.refetch()} showFarmer />
        </CardContent>
      </Card>
    </div>
  );
}
