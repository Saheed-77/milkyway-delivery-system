import { useMemo, useState } from "react";
import { Marker, Popup, Tooltip } from "react-leaflet";
import { Bike, CalendarCheck, Loader2, MapPin, Wand2, Zap } from "lucide-react";
import { InitialsAvatar } from "@/components/common/Brand";
import { PageHeader } from "@/components/common/PageHeader";
import { orderDisplayStatus, StatusBadge } from "@/components/common/StatusBadge";
import { BaseMap } from "@/components/maps/BaseMap";
import { depotIcon, RIDER_COLORS, stopIcon } from "@/components/maps/icons";
import { RiderMarker } from "@/components/maps/RiderMarker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAllOrders, useAssignOrder, useAutoAssign, useDepot, useGenerateSubscriptionOrders, useRiders } from "@/hooks/api/queries";
import { formatDistance, formatLiters, formatRelative, initials } from "@/lib/format";
import { haversine, type LatLng } from "@/lib/geo";
import { cn } from "@/lib/utils";
import { api, type Order, type Rider } from "@/services";
import { isAutoDispatch, setAutoDispatch } from "@/services/mock/simulator";

const hasPin = (o: Order) => o.delivery_lat != null && o.delivery_lng != null;
const pos = (o: Order): LatLng => ({ lat: o.delivery_lat!, lng: o.delivery_lng! });

function AssignSelect({ order, riders, origin }: { order: Order; riders: Rider[]; origin?: LatLng }) {
  const assign = useAssignOrder();
  const sorted = useMemo(
    () =>
      [...riders]
        .map((r) => ({ r, d: hasPin(order) && (r.location ?? origin) ? haversine(r.location ?? origin!, pos(order)) : Infinity }))
        .sort((a, b) => a.d - b.d),
    [riders, order, origin]
  );
  return (
    <Select
      value={order.delivery_person_id ?? "none"}
      disabled={assign.isPending}
      onValueChange={(v) => assign.mutate({ orderId: order.id, riderId: v === "none" ? null : v })}
    >
      <SelectTrigger className="h-8 w-[170px] text-xs">
        <SelectValue placeholder="Assign rider" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Unassigned</SelectItem>
        {sorted.map(({ r, d }) => (
          <SelectItem key={r.id} value={r.id}>
            {r.name} · {r.active_orders} stops{Number.isFinite(d) ? ` · ${formatDistance(d)}` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function LiveOps() {
  const pending = useAllOrders("pending");
  const onRoad = useAllOrders("out_for_delivery");
  const riders = useRiders();
  const depot = useDepot();
  const autoAssign = useAutoAssign();
  const generate = useGenerateSubscriptionOrders();
  const [selected, setSelected] = useState<string | null>(null);
  const [autoDispatch, setAuto] = useState(() => (api.mode === "demo" ? isAutoDispatch() : false));

  const riderList = riders.data ?? [];
  const colorOf = (id: string | null) => RIDER_COLORS[Math.max(0, riderList.findIndex((r) => r.id === id)) % RIDER_COLORS.length];
  const active = [...(pending.data ?? []), ...(onRoad.data ?? [])];
  const unassigned = active.filter((o) => !o.delivery_person_id);
  const fit = [...active.filter(hasPin).map(pos), ...riderList.filter((r) => r.location).map((r) => r.location!), ...(depot.data ? [depot.data] : [])];
  const selectedOrder = active.find((o) => o.id === selected);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Dispatch"
        title="Live Ops"
        description="Every rider and open order on one map. Click an order to assign it."
        actions={
          <>
            {api.mode === "demo" && (
              <div className="flex items-center gap-2 rounded-xl border bg-card px-3 py-1.5">
                <Zap className={cn("h-4 w-4", autoDispatch ? "text-warning" : "text-muted-foreground")} />
                <Label htmlFor="auto" className="text-sm">
                  Auto-dispatch
                </Label>
                <Switch
                  id="auto"
                  checked={autoDispatch}
                  onCheckedChange={(on) => {
                    setAutoDispatch(on);
                    setAuto(on);
                  }}
                />
              </div>
            )}
            <Button variant="outline" onClick={() => generate.mutate(undefined)} disabled={generate.isPending}>
              {generate.isPending ? <Loader2 className="animate-spin" /> : <CalendarCheck />} Bill subscriptions
            </Button>
            <Button onClick={() => autoAssign.mutate()} disabled={autoAssign.isPending || unassigned.length === 0}>
              {autoAssign.isPending ? <Loader2 className="animate-spin" /> : <Wand2 />} Auto-assign {unassigned.length || ""}
            </Button>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_400px]">
        <div className="relative">
          <BaseMap
            className="h-[55vh] min-h-[360px] xl:h-[calc(100svh-13rem)]"
            fitTo={fit.length ? fit : undefined}
            fitKey={`${active.map((o) => o.id).sort().join(",")}|${riderList.length}|${depot.data?.id ?? ""}`}
            fitPadding={50} ariaLabel="Live operations map">
            {depot.data && (
              <Marker position={depot.data} icon={depotIcon}>
                <Tooltip direction="top" offset={[0, -36]}>
                  {depot.data.name}
                </Tooltip>
              </Marker>
            )}
            {active.filter(hasPin).map((o) => (
              <Marker
                key={o.id}
                position={pos(o)}
                icon={stopIcon(
                  o.delivery_person_id ? initials(o.rider_name ?? "R") : "!",
                  o.id === selected ? "selected" : !o.delivery_person_id ? "unassigned" : o.status === "out_for_delivery" ? "next" : "upcoming"
                )}
                eventHandlers={{ click: () => setSelected(o.id) }}
              >
                <Popup>
                  <div className="space-y-2">
                    <p className="font-semibold">{o.customer_name}</p>
                    <p className="text-xs text-muted-foreground">{o.delivery_address}</p>
                    <p className="text-xs">
                      {formatLiters(o.quantity)} · {o.rider_name ? `Rider: ${o.rider_name}` : "Unassigned"}
                    </p>
                  </div>
                </Popup>
              </Marker>
            ))}
            {riderList
              .filter((r) => r.location)
              .map((r) => (
                <RiderMarker
                  key={r.id}
                  position={r.location!}
                  heading={r.location!.heading}
                  color={colorOf(r.id)}
                  label={initials(r.name)}
                  tooltip={`${r.name} · ${r.active_orders} open`}
                />
              ))}
          </BaseMap>

          <div className="absolute bottom-3 left-3 z-[500] flex flex-wrap gap-2 rounded-xl border bg-card/95 px-3 py-2 text-xs shadow backdrop-blur">
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-warning" /> Unassigned
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-info" /> Assigned
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-primary" /> On the way
            </span>
          </div>

          {selectedOrder && (
            <Card className="absolute inset-x-3 top-3 z-[500] mx-auto max-w-md shadow-lift">
              <CardContent className="flex flex-wrap items-center gap-3 p-3">
                <MapPin className="h-5 w-5 text-destructive" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{selectedOrder.customer_name}</p>
                  <p className="truncate text-xs text-muted-foreground">{selectedOrder.delivery_address}</p>
                </div>
                {selectedOrder.status === "pending" ? (
                  <AssignSelect order={selectedOrder} riders={riderList} origin={depot.data} />
                ) : (
                  <StatusBadge status={orderDisplayStatus(selectedOrder)} />
                )}
                <Button size="xs" variant="ghost" onClick={() => setSelected(null)}>
                  Close
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="flex flex-col xl:h-[calc(100svh-13rem)]">
          <Tabs defaultValue="queue" className="flex min-h-0 flex-1 flex-col">
            <CardHeader className="pb-3">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="queue">Queue ({unassigned.length})</TabsTrigger>
                <TabsTrigger value="riders">Riders ({riderList.length})</TabsTrigger>
              </TabsList>
            </CardHeader>
            <TabsContent value="queue" className="mt-0 min-h-0 flex-1">
              <ScrollArea className="h-[420px] xl:h-full">
                <div className="space-y-2 px-5 pb-5">
                  {active.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No open orders.</p>}
                  {[...unassigned, ...active.filter((o) => o.delivery_person_id)].map((o) => (
                    <div
                      key={o.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelected(o.id)}
                      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && e.target === e.currentTarget && setSelected(o.id)}
                      className={cn(
                        "w-full cursor-pointer rounded-xl border p-3 text-left transition-colors hover:bg-muted/50",
                        o.id === selected && "border-destructive bg-destructive-soft/40"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{o.customer_name}</p>
                          <p className="truncate text-xs text-muted-foreground">{o.delivery_address ?? "No pin"}</p>
                        </div>
                        <StatusBadge status={orderDisplayStatus(o)} />
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
                        <span className="text-xs text-muted-foreground">
                          {formatLiters(o.quantity)} · {formatRelative(o.created_at)}
                        </span>
                        {o.status === "pending" ? (
                          <AssignSelect order={o} riders={riderList} origin={depot.data} />
                        ) : (
                          <span className="text-xs font-medium">{o.rider_name}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
            <TabsContent value="riders" className="mt-0 min-h-0 flex-1">
              <ScrollArea className="h-[420px] xl:h-full">
                <div className="space-y-2 px-5 pb-5">
                  {riderList.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 rounded-xl border p-3">
                      <div className="relative">
                        <InitialsAvatar name={r.name} />
                        <span
                          className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card"
                          style={{ background: colorOf(r.id) }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{r.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.location ? `seen ${formatRelative(r.location.updated_at)}` : "no location yet"}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge variant={r.active_orders ? "info" : "muted"}>
                          <Bike className="h-3 w-3" /> {r.active_orders} open
                        </Badge>
                        <p className="mt-1 text-[11px] text-muted-foreground">{r.completed_today} done today</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
