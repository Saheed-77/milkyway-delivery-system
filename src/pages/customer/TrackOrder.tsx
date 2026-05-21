import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Marker, Popup } from "react-leaflet";
import { ArrowLeft, Bike, CalendarClock, Clock, KeyRound, MapPin, Navigation, PackageCheck, Phone, Route as RouteIcon } from "lucide-react";
import { ErrorState } from "@/components/common/EmptyState";
import { InitialsAvatar } from "@/components/common/Brand";
import { CardSkeleton } from "@/components/common/Skeletons";
import { orderDisplayStatus, StatusBadge } from "@/components/common/StatusBadge";
import { BaseMap } from "@/components/maps/BaseMap";
import { depotIcon, homeIcon } from "@/components/maps/icons";
import { RiderMarker } from "@/components/maps/RiderMarker";
import { RouteLine, useRoute } from "@/components/maps/RouteLine";
import { OrderTimeline } from "@/components/orders/OrderTimeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOrderTracking } from "@/hooks/api/queries";
import { formatCurrency, formatDistance, formatDuration, formatLiters, formatRelative, formatTime, paymentLabel } from "@/lib/format";
import { slotLabel } from "@/lib/schedule";
import { estimateSeconds, haversine, pathLength, type LatLng } from "@/lib/geo";

/** Remaining distance along a route from the vertex nearest to `pos`. */
function remainingAlong(path: LatLng[], pos: LatLng): number {
  if (path.length < 2) return 0;
  let best = 0;
  let bestD = Infinity;
  path.forEach((p, i) => {
    const d = haversine(p, pos);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return bestD + pathLength(path.slice(best));
}

export default function TrackOrder() {
  const { orderId } = useParams<{ orderId: string }>();
  const { data, isLoading, error, refetch } = useOrderTracking(orderId);
  const [anchor, setAnchor] = useState<LatLng | null>(null);

  const order = data?.order;
  const home = order?.delivery_lat != null && order.delivery_lng != null ? { lat: order.delivery_lat, lng: order.delivery_lng } : null;
  const loc = data?.location;
  const rider = useMemo(() => (loc ? { lat: loc.lat, lng: loc.lng } : null), [loc]);
  const onTheWay = order?.status === "out_for_delivery";

  // Route from where the rider was when we started following them; re-anchor
  // only if they move far off it (keeps OSRM calls rare while the marker glides).
  useEffect(() => {
    if (!rider || !onTheWay) return;
    if (!anchor || haversine(anchor, rider) > 1500) setAnchor(rider);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rider?.lat, rider?.lng, onTheWay]);

  const from = onTheWay ? anchor : data?.depot ?? null;
  const { route } = useRoute(from && home ? [from, home] : null);

  const remaining = useMemo(() => {
    if (!route || !rider || !onTheWay) return null;
    const meters = remainingAlong(route.path, rider);
    const seconds = route.source === "osrm" && route.distance > 0 ? (route.duration * meters) / route.distance : estimateSeconds(meters);
    return { meters, seconds };
  }, [route, rider, onTheWay]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        <CardSkeleton className="h-[420px]" />
        <CardSkeleton />
      </div>
    );
  }
  if (error || !data || !order) return <ErrorState error={error ?? "Order not found"} onRetry={() => refetch()} />;

  const fitPoints = [home, onTheWay ? rider : data.depot].filter(Boolean) as LatLng[];
  const arrivingSoon = remaining && remaining.meters < 150;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild aria-label="Back to orders">
            <Link to="/dashboard/customer/orders">
              <ArrowLeft />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold sm:text-2xl">Track order</h1>
            <p className="text-sm text-muted-foreground">#{order.id.slice(-6).toUpperCase()} · placed {formatRelative(order.created_at)}</p>
          </div>
        </div>
        <StatusBadge status={orderDisplayStatus(order)} className="text-sm" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        <div className="relative">
          <BaseMap
            className="h-[52vh] min-h-[320px] lg:h-[calc(100svh-12rem)]"
            fitTo={fitPoints}
            fitKey={`${order.id}|${order.status}|${!!rider}`}
            fitPadding={70} ariaLabel="Live delivery map">
            {route && <RouteLine path={route.path} estimated={route.source === "estimate"} muted={!onTheWay} />}
            <Marker position={data.depot} icon={depotIcon}>
              <Popup>
                <strong>{data.depot.name}</strong>
                <br />
                {data.depot.address}
              </Popup>
            </Marker>
            {home && (
              <Marker position={home} icon={homeIcon}>
                <Popup>{order.delivery_address ?? "Delivery location"}</Popup>
              </Marker>
            )}
            {rider && data.rider && order.status !== "completed" && (
              <RiderMarker position={rider} heading={data.location?.heading} tooltip={data.rider.name} />
            )}
          </BaseMap>

          {onTheWay && remaining && (
            <div className="pointer-events-none absolute inset-x-3 top-3 z-[500] flex justify-center">
              <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border bg-card/95 px-4 py-2.5 shadow-lift backdrop-blur">
                <Clock className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-bold">{arrivingSoon ? "Arriving now" : `Arriving in ${formatDuration(remaining.seconds)}`}</p>
                  <p className="text-xs text-muted-foreground">{formatDistance(remaining.meters)} away</p>
                </div>
              </div>
            </div>
          )}
          {!home && (
            <div className="absolute inset-x-3 bottom-3 z-[500] rounded-xl bg-warning-soft p-3 text-sm shadow">
              This order has no map pin. Add your location in Settings so riders can navigate to you next time.
            </div>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-4 p-5">
              <OrderTimeline order={order} />
              {order.status === "completed" && (
                <div className="flex items-center gap-3 rounded-xl bg-success-soft p-3 text-sm text-success">
                  <PackageCheck className="h-5 w-5" /> Delivered at {formatTime(order.delivered_at)}. Enjoy!
                </div>
              )}
            </CardContent>
          </Card>

          {order.delivery_otp && order.status !== "completed" && order.status !== "cancelled" && (
            <Card className="border-primary/30 bg-primary-soft/40">
              <CardContent className="flex items-center gap-4 p-5">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground">
                  <KeyRound className="h-5 w-5" />
                </span>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Delivery code</p>
                  <p className="font-mono text-3xl font-extrabold tracking-[0.3em]">{order.delivery_otp}</p>
                </div>
              </CardContent>
              <p className="px-5 pb-4 text-xs text-muted-foreground">Share it with your rider only when the milk is in your hands.</p>
            </Card>
          )}

          {data.rider ? (
            <Card>
              <CardContent className="flex items-center gap-3 p-5">
                <InitialsAvatar name={data.rider.name} className="h-12 w-12" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{data.rider.name}</p>
                  <p className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Bike className="h-3.5 w-3.5" /> Your MilkyWay rider
                    {data.location && ` · seen ${formatRelative(data.location.updated_at)}`}
                  </p>
                </div>
                {data.rider.phone && (
                  <Button size="icon" variant="soft" asChild aria-label={`Call ${data.rider.name}`}>
                    <a href={`tel:${data.rider.phone.replace(/\s/g, "")}`}>
                      <Phone />
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            order.status === "pending" && (
              <Card>
                <CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
                  <Navigation className="h-5 w-5 text-primary" /> We're finding the nearest rider for you…
                </CardContent>
              </Card>
            )
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Order details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {order.items.map((i, idx) => (
                <div key={idx} className="flex justify-between">
                  <span>{i.product_name}</span>
                  <span className="tabular-nums text-muted-foreground">{formatLiters(i.quantity)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t pt-2 font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{formatCurrency(order.total_amount)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {paymentLabel(order)}
                {order.payment_ref && <span className="font-mono"> · {order.payment_ref}</span>}
              </p>
              <p className="flex gap-1.5 text-xs font-medium">
                <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /> {slotLabel(order.delivery_slot)}
              </p>
              {order.delivery_address && (
                <p className="flex gap-1.5 pt-1 text-xs text-muted-foreground">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {order.delivery_address}
                </p>
              )}
              {route && (
                <p className="flex gap-1.5 text-xs text-muted-foreground">
                  <RouteIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {formatDistance(route.distance)} route{route.source === "estimate" && " (estimated)"}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
