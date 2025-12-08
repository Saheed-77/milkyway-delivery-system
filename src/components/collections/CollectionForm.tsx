import { useMemo, useState } from "react";
import { AlertTriangle, Ban, CheckCircle2, Loader2, Search } from "lucide-react";
import { InitialsAvatar, MilkDot } from "@/components/common/Brand";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFarmers, useSubmitCollection } from "@/hooks/api/queries";
import { MILK_LABELS } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MILK_TYPES, type CollectionResult, type MilkType, type QualityRating } from "@/services";

const QUALITY: { value: QualityRating; label: string; hint: string; tone: string }[] = [
  { value: 1, label: "Good", hint: "Passes all checks", tone: "data-[on=true]:border-success data-[on=true]:bg-success-soft" },
  { value: 2, label: "Average", hint: "Acceptable", tone: "data-[on=true]:border-warning data-[on=true]:bg-warning-soft" },
  { value: 3, label: "Substandard", hint: "Rejected, not stocked", tone: "data-[on=true]:border-destructive data-[on=true]:bg-destructive-soft" },
];

/**
 * Staff records a farmer's delivery at the collection point. Substandard
 * milk is logged but not stocked; three strikes in a row blacklists the farmer.
 */
export function CollectionForm() {
  const farmers = useFarmers();
  const submit = useSubmitCollection();
  const [code, setCode] = useState("");
  const [quantity, setQuantity] = useState("");
  const [quality, setQuality] = useState<QualityRating>(1);
  const [milkType, setMilkType] = useState<MilkType>("cow");
  const [result, setResult] = useState<CollectionResult | null>(null);

  const approved = useMemo(() => (farmers.data ?? []).filter((f) => f.status === "approved"), [farmers.data]);
  const match = approved.find((f) => String(f.farmer_code) === code.trim());
  const suggestions = code.trim() && !match
    ? approved.filter((f) => `${f.farmer_code} ${f.name} ${f.farm_name}`.toLowerCase().includes(code.trim().toLowerCase())).slice(0, 5)
    : [];
  const qty = Number(quantity);
  const valid = !!match && (quality === 3 || (qty > 0 && qty <= 10000));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!match) return;
    submit.mutate(
      { farmerCode: match.farmer_code, quantity: quality === 3 ? Math.max(qty, 1) : qty, qualityRating: quality, milkType },
      {
        onSuccess: (r) => {
          setResult(r);
          setQuantity("");
          setQuality(1);
          if (r.outcome !== "recorded") setCode("");
        },
      }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Record a collection</CardTitle>
        <CardDescription>Look up the farmer by ID or name, then enter quantity and quality.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-5" onSubmit={onSubmit}>
          <div className="relative space-y-1.5">
            <Label htmlFor="farmer">Farmer</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="farmer"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setResult(null);
                }}
                placeholder="Farmer ID (e.g. 1001) or name"
                className="pl-9"
                autoComplete="off"
              />
            </div>
            {suggestions.length > 0 && (
              <ul className="absolute z-20 mt-1 w-full rounded-xl border bg-popover p-1 shadow-lift">
                {suggestions.map((f) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-secondary"
                      onClick={() => setCode(String(f.farmer_code))}
                    >
                      <span className="w-12 font-mono text-xs text-muted-foreground">#{f.farmer_code}</span>
                      <span className="font-medium">{f.name}</span>
                      <span className="truncate text-muted-foreground">{f.farm_name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {match && (
              <div className="flex items-center gap-3 rounded-xl bg-primary-soft/60 p-2.5">
                <InitialsAvatar name={match.name} className="h-9 w-9" />
                <div className="text-sm">
                  <p className="font-semibold">{match.name}</p>
                  <p className="text-muted-foreground">
                    {match.farm_name} · {match.farm_location}
                  </p>
                </div>
              </div>
            )}
            {code.trim() && !match && suggestions.length === 0 && !farmers.isLoading && (
              <p className="text-xs text-destructive">No approved farmer matches “{code}”.</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="qty">Quantity (liters)</Label>
              <Input
                id="qty"
                type="number"
                inputMode="decimal"
                min={0.1}
                step={0.1}
                max={10000}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0.0"
                disabled={quality === 3}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Milk type</Label>
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
                {MILK_TYPES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMilkType(m)}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold capitalize",
                      milkType === m ? "bg-card shadow-sm" : "text-muted-foreground"
                    )}
                    aria-pressed={milkType === m}
                  >
                    <MilkDot type={m} /> {MILK_LABELS[m].split(" ")[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">Quality check</legend>
            <div className="grid grid-cols-3 gap-2">
              {QUALITY.map((q) => (
                <button
                  key={q.value}
                  type="button"
                  data-on={quality === q.value}
                  onClick={() => setQuality(q.value)}
                  aria-pressed={quality === q.value}
                  className={cn("rounded-xl border p-3 text-left transition-colors", q.tone)}
                >
                  <p className="text-sm font-semibold">{q.label}</p>
                  <p className="text-[11px] text-muted-foreground">{q.hint}</p>
                </button>
              ))}
            </div>
          </fieldset>

          <Button type="submit" className="w-full" disabled={!valid || submit.isPending}>
            {submit.isPending && <Loader2 className="animate-spin" />}
            {quality === 3 ? "Log rejected milk" : "Record collection"}
          </Button>

          {result && (
            <Alert
              variant={result.outcome === "recorded" ? "default" : "destructive"}
              className={cn(result.outcome === "recorded" && "border-success/40 bg-success-soft")}
            >
              {result.outcome === "recorded" ? (
                <CheckCircle2 className="h-4 w-4 !text-success" />
              ) : result.outcome === "blacklisted" ? (
                <Ban className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              <AlertTitle>
                {result.outcome === "recorded"
                  ? `Recorded for ${result.farmer_name}`
                  : result.outcome === "blacklisted"
                    ? `${result.farmer_name} has been blacklisted`
                    : `Substandard milk rejected (strike ${result.offense_count} of 3)`}
              </AlertTitle>
              <AlertDescription>
                {result.outcome === "recorded"
                  ? "Added to today's stock and the farmer's unpaid balance."
                  : result.outcome === "blacklisted"
                    ? "Three consecutive substandard submissions. An admin can reinstate them from Farmers."
                    : "Logged but not added to stock or payment."}
              </AlertDescription>
            </Alert>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
