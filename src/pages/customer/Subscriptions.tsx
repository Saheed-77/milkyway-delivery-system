import { useState } from "react";
import { CalendarClock, Loader2, Palmtree, Pause, Play, Plus, Repeat, Settings2, X } from "lucide-react";
import { MilkDot } from "@/components/common/Brand";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState, ErrorState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { ListSkeleton } from "@/components/common/Skeletons";
import { StatusBadge } from "@/components/common/StatusBadge";
import { SubscriptionManager } from "@/components/subscriptions/SubscriptionManager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateSubscription, useMySubscriptions, useProducts, useSetSubscriptionStatus } from "@/hooks/api/queries";
import { formatCurrency, formatDate, formatLiters, formatShortDate, round2 } from "@/lib/format";
import { DEFAULT_WINDOWS, activeVacation, windowLabel } from "@/lib/schedule";
import type { Frequency, Subscription } from "@/services";

const FREQ_LABEL: Record<Frequency, string> = { daily: "Every day", weekly: "Once a week", monthly: "Once a month" };
const PER: Record<Frequency, number> = { daily: 30, weekly: 30 / 7, monthly: 1 };

function NewSubscription({ onDone }: { onDone: () => void }) {
  const products = useProducts();
  const create = useCreateSubscription();
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [frequency, setFrequency] = useState<Frequency>("daily");
  const [slotStart, setSlotStart] = useState("06:00");

  const product = products.data?.find((p) => p.id === productId);
  const qty = Number(quantity);
  const valid = !!product && qty > 0 && qty <= 50;
  const monthly = product && valid ? round2(product.price * qty * PER[frequency]) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>New subscription</CardTitle>
        <CardDescription>Billed from your wallet on each delivery day. Pause or cancel any time.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid) return;
            create.mutate({ productId, quantity: qty, frequency, preferredSlotStart: slotStart }, { onSuccess: onDone });
          }}
        >
          <div className="space-y-1.5">
            <Label>Milk</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger>
                <SelectValue placeholder={products.isLoading ? "Loading…" : "Choose milk"} />
              </SelectTrigger>
              <SelectContent>
                {products.data?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} · {formatCurrency(p.price)}/L
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sub-qty">Liters per delivery</Label>
            <Input
              id="sub-qty"
              type="number"
              inputMode="decimal"
              min={0.5}
              max={50}
              step={0.5}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              aria-invalid={!!quantity && !(qty > 0 && qty <= 50)}
            />
            {!!quantity && !(qty > 0 && qty <= 50) && <p className="text-xs text-destructive">Enter 0.5 – 50 liters</p>}
          </div>
          <div className="space-y-1.5">
            <Label>How often</Label>
            <Select value={frequency} onValueChange={(v) => setFrequency(v as Frequency)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(FREQ_LABEL) as Frequency[]).map((f) => (
                  <SelectItem key={f} value={f}>
                    {FREQ_LABEL[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Delivery window</Label>
            <Select value={slotStart} onValueChange={setSlotStart}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEFAULT_WINDOWS.map((w) => (
                  <SelectItem key={w.start} value={w.start}>
                    {windowLabel(w.start, w.end)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2 lg:col-span-4">
            <p className="text-sm text-muted-foreground">
              {product && valid ? (
                <>
                  About <span className="font-semibold text-foreground">{formatCurrency(monthly)}</span> per month
                </>
              ) : (
                "Choose a milk and quantity to see the monthly estimate."
              )}
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={onDone}>
                Cancel
              </Button>
              <Button type="submit" disabled={!valid || create.isPending}>
                {create.isPending && <Loader2 className="animate-spin" />}
                Start subscription
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function SubscriptionRow({ sub }: { sub: Subscription }) {
  const setStatus = useSetSubscriptionStatus();
  const busy = setStatus.isPending;
  const vacation = activeVacation(sub.skip_dates);
  const pref = DEFAULT_WINDOWS.find((w) => w.start === sub.preferred_slot_start);
  return (
    <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
      <div className="flex flex-1 items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary-soft text-primary">
          <Repeat className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-semibold">
            <MilkDot type={sub.milk_type} /> {sub.product_name}
          </p>
          <p className="text-sm text-muted-foreground">
            {formatLiters(sub.quantity)} · {FREQ_LABEL[sub.frequency].toLowerCase()}
            {pref && ` · ${windowLabel(pref.start, pref.end)}`}
          </p>
          {vacation && sub.status === "active" && (
            <Badge variant="warning" className="mt-1">
              <Palmtree className="h-3 w-3" /> On vacation until {formatShortDate(vacation.to)}
            </Badge>
          )}
          {!vacation && sub.skip_dates.length > 0 && sub.status === "active" && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {sub.skip_dates.length} upcoming skip{sub.skip_dates.length > 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        {sub.status === "active" && sub.next_delivery && (
          <span className="flex items-center gap-1">
            <CalendarClock className="h-4 w-4" /> Next {formatDate(sub.next_delivery)}
          </span>
        )}
        <StatusBadge status={sub.status} />
      </div>
      {sub.status !== "cancelled" && (
        <div className="flex flex-wrap gap-2">
          <SubscriptionManager
            sub={sub}
            trigger={
              <Button size="sm" variant="soft">
                <Settings2 /> Manage
              </Button>
            }
          />
          {sub.status === "active" ? (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setStatus.mutate({ id: sub.id, status: "paused" })}>
              <Pause /> Pause
            </Button>
          ) : (
            <Button size="sm" variant="soft" disabled={busy} onClick={() => setStatus.mutate({ id: sub.id, status: "active" })}>
              <Play /> Resume
            </Button>
          )}
          <ConfirmDialog
            trigger={
              <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive-soft hover:text-destructive" disabled={busy}>
                <X /> Cancel
              </Button>
            }
            title="Cancel subscription?"
            description="Deliveries stop from tomorrow. You can start a new subscription any time."
            confirmLabel="Cancel subscription"
            cancelLabel="Keep it"
            variant="destructive"
            onConfirm={() => setStatus.mutateAsync({ id: sub.id, status: "cancelled" })}
          />
        </div>
      )}
    </Card>
  );
}

export default function Subscriptions() {
  const { data = [], isLoading, error, refetch } = useMySubscriptions();
  const [creating, setCreating] = useState(false);
  const live = data.filter((s) => s.status !== "cancelled");
  const past = data.filter((s) => s.status === "cancelled");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscriptions"
        description="Never run out — scheduled deliveries billed from your wallet."
        actions={
          !creating && (
            <Button onClick={() => setCreating(true)}>
              <Plus /> New subscription
            </Button>
          )
        }
      />
      {creating && <NewSubscription onDone={() => setCreating(false)} />}

      {isLoading ? (
        <ListSkeleton rows={3} />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : live.length === 0 && !creating ? (
        <EmptyState
          icon={Repeat}
          title="No subscriptions yet"
          description="Set up a daily, weekly or monthly delivery and we'll handle the rest."
          action={
            <Button variant="soft" onClick={() => setCreating(true)}>
              <Plus /> Start one
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {live.map((s) => (
            <SubscriptionRow key={s.id} sub={s} />
          ))}
        </div>
      )}

      {past.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm font-semibold text-muted-foreground">Cancelled ({past.length})</summary>
          <div className="mt-3 space-y-3 opacity-70">
            {past.map((s) => (
              <SubscriptionRow key={s.id} sub={s} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
