import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Banknote, Bike, Loader2, Minus, Plus, Wallet } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { MilkDot } from "@/components/common/Brand";
import { ErrorState } from "@/components/common/EmptyState";
import { CardSkeleton } from "@/components/common/Skeletons";
import { LocationPickerField, type PickedLocation } from "@/components/maps/LocationPickerField";
import { OrderTimeline } from "@/components/orders/OrderTimeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useMyOrders, usePlaceOrder, useProducts, useWalletBalance } from "@/hooks/api/queries";
import { formatCurrency, MILK_LABELS, round2 } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MILK_TYPES, type MilkType, type PaymentMethod, type Product } from "@/services";

const BLURB: Record<MilkType, string> = {
  cow: "Everyday fresh milk, collected this morning.",
  buffalo: "Rich and creamy — perfect for chai and curd.",
  goat: "Light, easy to digest, A2-friendly.",
};

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

export default function OrderMilk() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const products = useProducts();
  const balance = useWalletBalance();
  const orders = useMyOrders();
  const placeOrder = usePlaceOrder();

  const [milkType, setMilkType] = useState<MilkType>("cow");
  const [quantity, setQuantity] = useState(1);
  const [method, setMethod] = useState<PaymentMethod>("wallet");
  const [notes, setNotes] = useState("");
  const [location, setLocation] = useState<PickedLocation | null>(
    profile?.latitude != null && profile.longitude != null
      ? { lat: profile.latitude, lng: profile.longitude, address: profile.address }
      : null
  );

  // place_order charges the cheapest active product of the milk type, so show exactly that price.
  const byType = useMemo(() => {
    const map = new Map<MilkType, Product>();
    for (const p of products.data ?? []) {
      const cur = map.get(p.milk_type);
      if (!cur || p.price < cur.price) map.set(p.milk_type, p);
    }
    return map;
  }, [products.data]);

  const selected = byType.get(milkType);
  const total = selected ? round2(selected.price * quantity) : 0;
  const shortBy = method === "wallet" && balance.data !== undefined ? round2(total - balance.data) : 0;
  const active = orders.data?.find((o) => o.status === "pending" || o.status === "out_for_delivery");

  const submit = () => {
    placeOrder.mutate(
      {
        milkType,
        quantity,
        paymentMethod: method,
        address: location?.address ?? profile?.address ?? undefined,
        lat: location?.lat,
        lng: location?.lng,
        notes,
      },
      { onSuccess: (id) => navigate(`/dashboard/customer/track/${id}`) }
    );
  };

  const step = (d: number) => setQuantity((q) => Math.min(20, Math.max(0.5, round2(q + d))));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={greeting()}
        title={`What can we bring you, ${profile?.first_name ?? "friend"}?`}
        description="Fresh milk from local farms, delivered to your door. Follow your rider live on the map."
        actions={
          <Button variant="outline" asChild>
            <Link to="/dashboard/customer/wallet">
              <Wallet /> {balance.data !== undefined ? formatCurrency(balance.data) : "Wallet"}
            </Link>
          </Button>
        }
      />

      {active && (
        <Card className="overflow-hidden border-primary/30">
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground">
                <Bike className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold">{active.status === "out_for_delivery" ? "Your milk is on the way" : "Order received"}</p>
                <p className="text-sm text-muted-foreground">
                  {active.quantity} L · {formatCurrency(active.total_amount)}
                  {active.delivery_otp && ` · Delivery code ${active.delivery_otp}`}
                </p>
              </div>
            </div>
            <OrderTimeline order={active} className="flex-1 sm:px-4" />
            <Button asChild>
              <Link to={`/dashboard/customer/track/${active.id}`}>
                Track live <ArrowRight />
              </Link>
            </Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section aria-labelledby="choose-milk" className="space-y-3">
            <h2 id="choose-milk" className="text-lg font-semibold">
              1. Choose your milk
            </h2>
            {products.isLoading ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {MILK_TYPES.map((m) => (
                  <CardSkeleton key={m} lines={2} />
                ))}
              </div>
            ) : products.error ? (
              <ErrorState error={products.error} onRetry={() => products.refetch()} />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Milk type">
                {MILK_TYPES.map((m) => {
                  const p = byType.get(m);
                  const isSel = milkType === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={isSel}
                      disabled={!p}
                      onClick={() => setMilkType(m)}
                      className={cn(
                        "group relative rounded-2xl border bg-card p-4 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lift disabled:opacity-50",
                        isSel && "border-primary ring-2 ring-primary/30"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 font-semibold">
                          <MilkDot type={m} className="h-3 w-3" />
                          {MILK_LABELS[m]}
                        </span>
                        <span
                          className={cn(
                            "grid h-5 w-5 place-items-center rounded-full border-2",
                            isSel ? "border-primary" : "border-border"
                          )}
                        >
                          {isSel && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
                        </span>
                      </div>
                      <p className="mt-2 text-2xl font-bold">
                        {p ? formatCurrency(p.price) : "—"}
                        <span className="text-sm font-medium text-muted-foreground"> / L</span>
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{p ? BLURB[m] : "Currently unavailable"}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section aria-labelledby="qty" className="space-y-3">
            <h2 id="qty" className="text-lg font-semibold">
              2. How much?
            </h2>
            <Card className="flex flex-wrap items-center gap-4 p-4">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => step(-0.5)} aria-label="Less" disabled={quantity <= 0.5}>
                  <Minus />
                </Button>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0.5}
                  max={20}
                  step={0.5}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.min(20, Math.max(0.5, Number(e.target.value) || 0.5)))}
                  className="w-20 text-center text-lg font-bold"
                  aria-label="Quantity in liters"
                />
                <Button variant="outline" size="icon" onClick={() => step(0.5)} aria-label="More" disabled={quantity >= 20}>
                  <Plus />
                </Button>
                <span className="text-sm text-muted-foreground">liters</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 5].map((q) => (
                  <Button key={q} size="sm" variant={quantity === q ? "soft" : "ghost"} onClick={() => setQuantity(q)}>
                    {q} L
                  </Button>
                ))}
              </div>
            </Card>
          </section>

          <section aria-labelledby="where" className="space-y-3">
            <h2 id="where" className="text-lg font-semibold">
              3. Where should we deliver?
            </h2>
            <Card className="space-y-4 p-4">
              <LocationPickerField value={location} onChange={setLocation} />
              <div className="space-y-1.5">
                <Label htmlFor="notes">Note for the rider (optional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value.slice(0, 200))}
                  placeholder="e.g. Leave at the gate, ring twice"
                  rows={2}
                />
              </div>
            </Card>
          </section>
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Order summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{selected?.name ?? MILK_LABELS[milkType]}</span>
                  <span className="tabular-nums">
                    {quantity} L × {selected ? formatCurrency(selected.price) : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Delivery</span>
                  <span className="font-medium text-success">Free</span>
                </div>
                <div className="flex justify-between border-t pt-2 text-base font-bold">
                  <span>Total</span>
                  <span className="tabular-nums">{formatCurrency(total)}</span>
                </div>
              </div>

              <RadioGroup value={method} onValueChange={(v) => setMethod(v as PaymentMethod)} className="grid gap-2">
                {(
                  [
                    ["wallet", Wallet, "Wallet", balance.data !== undefined ? `Balance ${formatCurrency(balance.data)}` : "Loading…"],
                    ["cash", Banknote, "Cash on delivery", "Pay the rider at your door"],
                  ] as const
                ).map(([value, Icon, label, hint]) => (
                  <Label
                    key={value}
                    htmlFor={`pm-${value}`}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors",
                      method === value && "border-primary bg-primary-soft/50"
                    )}
                  >
                    <RadioGroupItem id={`pm-${value}`} value={value} />
                    <Icon className="h-4 w-4 text-primary" />
                    <span className="flex-1">
                      <span className="block font-semibold">{label}</span>
                      <span className="block text-xs font-normal text-muted-foreground">{hint}</span>
                    </span>
                  </Label>
                ))}
              </RadioGroup>

              {shortBy > 0 && (
                <div className="rounded-xl bg-warning-soft p-3 text-sm">
                  You need {formatCurrency(shortBy)} more.{" "}
                  <Link to="/dashboard/customer/wallet" className="font-semibold text-primary underline-offset-2 hover:underline">
                    Recharge wallet
                  </Link>{" "}
                  or choose cash.
                </div>
              )}

              <Button size="lg" className="w-full" onClick={submit} disabled={!selected || placeOrder.isPending || shortBy > 0}>
                {placeOrder.isPending && <Loader2 className="animate-spin" />}
                Place order · {formatCurrency(total)}
              </Button>
              {!location && (
                <p className="text-center text-xs text-muted-foreground">
                  Tip: pin your location so the rider can navigate to your door.
                </p>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
