import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Marker, Popup } from "react-leaflet";
import {
  Banknote,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Milk,
  Navigation,
  Phone,
  PlayCircle,
  Radio,
  Route as RouteIcon,
  StickyNote,
} from "lucide-react";
import { EmptyState, ErrorState } from "@/components/common/EmptyState";
import { CardSkeleton } from "@/components/common/Skeletons";
import { orderDisplayStatus, StatusBadge } from "@/components/common/StatusBadge";
import { CompleteDeliveryDialog } from "@/components/delivery/CompleteDeliveryDialog";
import { BaseMap } from "@/components/maps/BaseMap";
import { depotIcon, stopIcon } from "@/components/maps/icons";
import { RiderMarker } from "@/components/maps/RiderMarker";
import { RouteLine, useRoute } from "@/components/maps/RouteLine";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useDepot, useMyStops, useStartDelivery } from "@/hooks/api/queries";
import { useRiderGps } from "@/hooks/useRiderGps";
import { formatCurrency, formatDistance, formatDuration, formatLiters } from "@/lib/format";
import { haversine, type LatLng } from "@/lib/geo";
import { navigationUrl, optimizeStops } from "@/lib/routing";
import { cn } from "@/lib/utils";
import { api, type Order } from "@/services";

const ARRIVED_M = 80;
const hasPin = (o: Order) => o.delivery_lat != null && o.delivery_lng != null;
const pos = (o: Order): LatLng => ({ lat: o.delivery_lat!, lng: o.delivery_lng! });

function useMyLocation(riderId: string | undefined) {
  return useQuery({
    queryKey: ["riders", "me", riderId],
    queryFn: async () => (await api.delivery.locations()).find((l) => l.rider_id === riderId) ?? null,
    enabled: !!riderId,
  });
}

export default function RiderRoute() {
  const { profile } = useAuth();
  const stops = useMyStops();
  const depot = useDepot();
  const myLoc = useMyLocation(profile?.id);
  const start = useStartDelivery();
  const gps = useRiderGps(profile?.id);

  const assigned = useMemo(() => stops.data?.assigned ?? [], [stops.data]);
  const current: LatLng | null = gps.position ?? (myLoc.data ? { lat: myLoc.data.lat, lng: myLoc.data.lng } : null) ?? depot.data ?? null;

  // Optimise once per set of stops (not on every GPS tick) so the order is stable.
  const stopKey = assigned.map((o) => o.id).sort().join(",");
  const ordered = useMemo(() => {
    const pinned = assigned.filter(hasPin).map((o) => ({ ...pos(o), o }));
    const start = current ?? depot.data;
    const sorted = start ? optimizeStops(start, pinned).map((x) => x.o) : pinned.map((x) => x.o);
    return [...sorted, ...assigned.filter((o) => !hasPin(o))];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopKey, depot.data?.id]);

  const routeStart = useMemo(() => current, [stopKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const waypoints = routeStart ? [routeStart, ...ordered.filter(hasPin).map(pos)] : null;
  const { route } = useRoute(waypoints && waypoints.length > 1 ? waypoints : null);

  const pending = assigned.filter((o) => o.status === "pending");
  const next = ordered[0];
  const distToNext = next && hasPin(next) && current ? haversine(current, pos(next)) : null;
  const arrived = distToNext !== null && distToNext < ARRIVED_M;
  const liters = assigned.reduce((s, o) => s + o.quantity, 0);
  const cash = assigned.filter((o) => o.payment_method === "cash").reduce((s, o) => s + o.total_amount, 0);

  if (stops.isLoading || depot.isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
        <CardSkeleton className="h-[480px]" />
        <CardSkeleton lines={6} />
      </div>
    );
  }
  if (stops.error) return <ErrorState error={stops.error} onRetry={() => stops.refetch()} />;

  const fitPoints = [current, ...ordered.filter(hasPin).map(pos)].filter(Boolean) as LatLng[];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Today's route</p>
          <h1 className="text-2xl font-bold">
            {assigned.length ? `${assigned.length} stop${assigned.length > 1 ? "s" : ""} to go` : "No stops right now"}
          </h1>
        </div>
        <div className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2">
          <Radio className={cn("h-4 w-4", gps.sharing ? "text-success" : "text-muted-foreground")} />
          <Label htmlFor="gps" className="text-sm font-medium">
            {gps.demo ? "Simulate driving" : "Share live location"}
          </Label>
          <Switch id="gps" checked={gps.sharing} onCheckedChange={(on) => (on ? gps.start() : gps.stop())} />
        </div>
      </div>
      {gps.error && <p className="rounded-xl bg-destructive-soft px-3 py-2 text-sm text-destructive">{gps.error}</p>}

      <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
        <BaseMap className="h-[45vh] min-h-[300px] lg:h-[calc(100svh-13rem)]" fitTo={fitPoints} fitPadding={60} ariaLabel="Route map">
          {route && <RouteLine path={route.path} estimated={route.source === "estimate"} />}
          {depot.data && (
            <Marker position={depot.data} icon={depotIcon}>
              <Popup>{depot.data.name}</Popup>
            </Marker>
          )}
          {ordered.filter(hasPin).map((o, i) => (
            <Marker key={o.id} position={pos(o)} icon={stopIcon(i + 1, i === 0 ? "next" : "upcoming")}>
              <Popup>
                <strong>
                  {i + 1}. {o.customer_name}
                </strong>
                <br />
                {o.delivery_address}
                <br />
                {formatLiters(o.quantity)} · {o.payment_method === "cash" ? `collect ${formatCurrency(o.total_amount)}` : "prepaid"}
              </Popup>
            </Marker>
          ))}
          {current && profile && (myLoc.data || gps.position) && (
            <RiderMarker position={current} heading={myLoc.data?.heading} tooltip="You" />
          )}
        </BaseMap>

        <div className="space-y-4">
          {assigned.length > 0 && (
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                [RouteIcon, route ? formatDistance(route.distance) : "—", "distance"],
                [Clock, route ? formatDuration(route.duration + assigned.length * 120) : "—", "incl. hand-offs"],
                [Milk, formatLiters(liters, 1), cash ? `${formatCurrency(cash)} cash` : "all prepaid"],
              ].map(([Icon, value, label], i) => {
                const I = Icon as typeof Clock;
                return (
                  <Card key={i} className="p-3">
                    <I className="mx-auto mb-1 h-4 w-4 text-primary" />
                    <p className="text-sm font-bold">{value as string}</p>
                    <p className="text-[11px] text-muted-foreground">{label as string}</p>
                  </Card>
                );
              })}
            </div>
          )}

          {pending.length > 0 && (
            <Button size="lg" className="w-full" disabled={start.isPending} onClick={() => start.mutate(pending.map((o) => o.id), { onSuccess: () => !gps.sharing && gps.start() })}>
              {start.isPending ? <Loader2 className="animate-spin" /> : <PlayCircle />}
              Start trip · {pending.length} stop{pending.length > 1 ? "s" : ""}
            </Button>
          )}

          {next ? (
            <Card className={cn("border-primary/40", arrived && "border-success ring-2 ring-success/30")}>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center justify-between">
                  <Badge variant={arrived ? "success" : "brand"}>{arrived ? "You've arrived" : "Next stop"}</Badge>
                  <StatusBadge status={orderDisplayStatus(next)} />
                </div>
                <div>
                  <p className="text-lg font-bold">{next.customer_name}</p>
                  <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                    {next.delivery_address ?? "No address"}
                    {distToNext !== null && !arrived && <span className="whitespace-nowrap"> · {formatDistance(distToNext)}</span>}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-sm">
                  {next.items.map((i, idx) => (
                    <span key={idx} className="rounded-lg bg-secondary px-2 py-1 font-medium">
                      {formatLiters(i.quantity)} {i.product_name}
                    </span>
                  ))}
                  {next.payment_method === "cash" && (
                    <span className="flex items-center gap-1 rounded-lg bg-warning-soft px-2 py-1 font-semibold">
                      <Banknote className="h-4 w-4" /> Collect {formatCurrency(next.total_amount)}
                    </span>
                  )}
                </div>
                {next.delivery_notes && (
                  <p className="flex items-start gap-1.5 rounded-lg bg-muted p-2 text-sm">
                    <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /> {next.delivery_notes}
                  </p>
                )}
                <div className="grid grid-cols-3 gap-2">
                  <Button variant="outline" asChild disabled={!hasPin(next)}>
                    <a href={hasPin(next) ? navigationUrl(pos(next), current) : undefined} target="_blank" rel="noreferrer">
                      <Navigation /> Navigate
                    </a>
                  </Button>
                  <Button variant="outline" asChild disabled={!next.customer_phone}>
                    <a href={next.customer_phone ? `tel:${next.customer_phone.replace(/\s/g, "")}` : undefined}>
                      <Phone /> Call
                    </a>
                  </Button>
                  <CompleteDeliveryDialog
                    order={next}
                    trigger={
                      <Button variant={arrived ? "success" : "default"}>
                        <CheckCircle2 /> Done
                      </Button>
                    }
                  />
                </div>
              </CardContent>
            </Card>
          ) : (
            <EmptyState
              icon={RouteIcon}
              title="You're all caught up"
              description="New stops appear here as soon as they're assigned. You can also pick up waiting orders."
              action={
                <Button variant="soft" asChild>
                  <Link to="/dashboard/delivery/pending">See available orders</Link>
                </Button>
              }
            />
          )}

          {ordered.length > 1 && (
            <Card>
              <CardContent className="p-2">
                <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Then</p>
                <ol>
                  {ordered.slice(1).map((o, i) => (
                    <li key={o.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted/60">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-info text-xs font-bold text-info-foreground">
                        {i + 2}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{o.customer_name}</p>
                        <p className="truncate text-xs text-muted-foreground">{o.delivery_address}</p>
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">{formatLiters(o.quantity)}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
