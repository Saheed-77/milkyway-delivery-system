import { useState } from "react";
import { CollectionForm } from "@/components/collections/CollectionForm";
import { ContributionsTable } from "@/components/collections/ContributionsTable";
import { DateRangePicker } from "@/components/common/DateRangePicker";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAllContributions } from "@/hooks/api/queries";
import { formatLiters, toLocalISODate } from "@/lib/format";
import type { DateRange } from "@/services";

export default function Collections() {
  const [range, setRange] = useState<DateRange | undefined>({ from: toLocalISODate(), to: toLocalISODate() });
  const q = useAllContributions(range);
  const total = (q.data ?? []).reduce((s, c) => s + c.quantity, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Milk collection" description="Record farmer deliveries at the collection point with a quality check." />
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <CollectionForm />
        <Card>
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
            <CardTitle>
              Collected {range?.from === toLocalISODate() && range?.to === toLocalISODate() ? "today" : "in range"} ·{" "}
              <span className="text-primary">{formatLiters(total, 1)}</span>
            </CardTitle>
            <DateRangePicker value={range} onChange={setRange} />
          </CardHeader>
          <CardContent>
            <ContributionsTable rows={q.data} isLoading={q.isLoading} error={q.error} onRetry={() => q.refetch()} showFarmer />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
