import { useEffect, useState } from "react";
import { History, Loader2, Save, Store, Tractor } from "lucide-react";
import { MilkDot } from "@/components/common/Brand";
import { PageHeader } from "@/components/common/PageHeader";
import { ResponsiveTable } from "@/components/common/ResponsiveTable";
import { ListSkeleton } from "@/components/common/Skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentPrices, usePriceHistory, useProducts, useSetPrices, useUpdateProduct } from "@/hooks/api/queries";
import { formatCurrency, formatDate, MILK_LABELS, toLocalISODate } from "@/lib/format";
import { MILK_TYPES, type MilkType, type Product } from "@/services";

function FarmerPrices() {
  const current = useCurrentPrices();
  const setPrices = useSetPrices();
  const [draft, setDraft] = useState<Record<MilkType, string>>({ cow: "", buffalo: "", goat: "" });

  useEffect(() => {
    if (current.data) {
      setDraft({
        cow: String(current.data.cow?.price_per_liter ?? ""),
        buffalo: String(current.data.buffalo?.price_per_liter ?? ""),
        goat: String(current.data.goat?.price_per_liter ?? ""),
      });
    }
  }, [current.data]);

  const changed = MILK_TYPES.filter((m) => draft[m] !== "" && Number(draft[m]) !== (current.data?.[m]?.price_per_liter ?? NaN));
  const invalid = MILK_TYPES.some((m) => draft[m] !== "" && !(Number(draft[m]) > 0));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tractor className="h-5 w-5 text-primary" /> Farmer purchase price
        </CardTitle>
        <CardDescription>
          What farmers earn per liter. Changes apply from today; past collections keep the price that was in effect.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {MILK_TYPES.map((m) => (
            <div key={m} className="space-y-1.5">
              <Label htmlFor={`fp-${m}`} className="flex items-center gap-1.5">
                <MilkDot type={m} /> {MILK_LABELS[m]}
              </Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                <Input
                  id={`fp-${m}`}
                  type="number"
                  inputMode="decimal"
                  min={0.01}
                  step={0.5}
                  className="pl-7"
                  value={draft[m]}
                  onChange={(e) => setDraft((d) => ({ ...d, [m]: e.target.value }))}
                  aria-invalid={draft[m] !== "" && !(Number(draft[m]) > 0)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {current.data?.[m] ? `since ${formatDate(current.data[m]!.effective_from)}` : "not set"}
              </p>
            </div>
          ))}
        </div>
        <Button
          disabled={!changed.length || invalid || setPrices.isPending}
          onClick={() => setPrices.mutate(Object.fromEntries(changed.map((m) => [m, Number(draft[m])])) as Partial<Record<MilkType, number>>)}
        >
          {setPrices.isPending ? <Loader2 className="animate-spin" /> : <Save />}
          Save {changed.length ? `${changed.length} change${changed.length > 1 ? "s" : ""}` : ""}
        </Button>
      </CardContent>
    </Card>
  );
}

function ProductRow({ product }: { product: Product }) {
  const update = useUpdateProduct();
  const [price, setPrice] = useState(String(product.price));
  useEffect(() => setPrice(String(product.price)), [product.price]);
  const dirty = Number(price) !== product.price;
  return (
    <TableRow>
      <TableCell>
        <span className="flex items-center gap-2 font-medium">
          <MilkDot type={product.milk_type} /> {product.name}
        </span>
      </TableCell>
      <TableCell>
        <div className="relative w-28">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
          <Input type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} className="h-8 pl-6" aria-label={`${product.name} price`} />
        </div>
      </TableCell>
      <TableCell>
        <Switch checked={product.is_active} disabled={update.isPending} onCheckedChange={(on) => update.mutate({ id: product.id, is_active: on })} aria-label="Available to customers" />
      </TableCell>
      <TableCell className="text-right">
        <Button size="sm" variant="soft" disabled={!dirty || !(Number(price) > 0) || update.isPending} onClick={() => update.mutate({ id: product.id, price: Number(price) })}>
          Save
        </Button>
      </TableCell>
    </TableRow>
  );
}

export default function AdminPricing() {
  const products = useProducts(true);
  const history = usePriceHistory();
  const today = toLocalISODate();

  return (
    <div className="space-y-6">
      <PageHeader title="Pricing" description="Set what farmers are paid and what customers are charged." />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <FarmerPrices />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5 text-primary" /> Customer catalogue
            </CardTitle>
            <CardDescription>Orders are charged at the cheapest active product of each milk type.</CardDescription>
          </CardHeader>
          <CardContent>
            {products.isLoading ? (
              <ListSkeleton rows={3} />
            ) : (
              <ResponsiveTable>
                <Table className="min-w-[480px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Price / L</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.data?.map((p) => (
                      <ProductRow key={p.id} product={p} />
                    ))}
                  </TableBody>
                </Table>
              </ResponsiveTable>
            )}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" /> Farmer price history
          </CardTitle>
          <CardDescription>Kept for accurate, date-based farmer payments (previously every row was overwritten).</CardDescription>
        </CardHeader>
        <CardContent>
          {history.isLoading ? (
            <ListSkeleton rows={3} />
          ) : (
            <ResponsiveTable>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Effective from</TableHead>
                    <TableHead>Milk</TableHead>
                    <TableHead className="text-right">Price / L</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.data?.map((h, i, all) => {
                    const isCurrent = h.effective_from <= today && !all.some((x) => x.milk_type === h.milk_type && x.effective_from > h.effective_from && x.effective_from <= today);
                    return (
                      <TableRow key={h.id}>
                        <TableCell>{formatDate(h.effective_from)}</TableCell>
                        <TableCell className="capitalize">
                          <span className="flex items-center gap-1.5">
                            <MilkDot type={h.milk_type} /> {h.milk_type}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(h.price_per_liter)}</TableCell>
                        <TableCell>{isCurrent && <Badge variant="success">Current</Badge>}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ResponsiveTable>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
