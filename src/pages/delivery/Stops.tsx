import { Link } from "react-router-dom";
import { CheckCircle2, ClipboardList, Hand, Navigation, Phone } from "lucide-react";
import { EmptyState, ErrorState } from "@/components/common/EmptyState";
import { PageHeader, SectionTitle } from "@/components/common/PageHeader";
import { ListSkeleton } from "@/components/common/Skeletons";
import { CompleteDeliveryDialog } from "@/components/delivery/CompleteDeliveryDialog";
import { OrderCard } from "@/components/orders/OrderCard";
import { Button } from "@/components/ui/button";
import { useClaimOrder, useMyStops } from "@/hooks/api/queries";
import { formatRelative } from "@/lib/format";
import { navigationUrl } from "@/lib/routing";

export default function Stops() {
  const { data, isLoading, error, refetch } = useMyStops();
  const claim = useClaimOrder();

  if (isLoading) return <ListSkeleton rows={5} />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  const assigned = data?.assigned ?? [];
  const available = data?.available ?? [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Stops"
        description="Your assigned deliveries, plus orders waiting for a rider nearby."
        actions={
          <Button asChild variant="outline">
            <Link to="/dashboard/delivery">
              <Navigation /> Open route map
            </Link>
          </Button>
        }
      />

      <section className="space-y-3">
        <SectionTitle title={`Assigned to you (${assigned.length})`} />
        {assigned.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No assigned stops" description="Claim an available order below or wait for dispatch." compact />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {assigned.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                showCustomer
                actions={
                  <>
                    {o.delivery_lat != null && o.delivery_lng != null && (
                      <Button size="sm" variant="outline" asChild>
                        <a href={navigationUrl({ lat: o.delivery_lat, lng: o.delivery_lng })} target="_blank" rel="noreferrer">
                          <Navigation /> Navigate
                        </a>
                      </Button>
                    )}
                    {o.customer_phone && (
                      <Button size="sm" variant="outline" asChild>
                        <a href={`tel:${o.customer_phone.replace(/\s/g, "")}`}>
                          <Phone /> Call
                        </a>
                      </Button>
                    )}
                    <CompleteDeliveryDialog
                      order={o}
                      trigger={
                        <Button size="sm">
                          <CheckCircle2 /> Delivered
                        </Button>
                      }
                    />
                  </>
                }
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <SectionTitle title={`Available orders (${available.length})`} description="First come, first served." />
        {available.length === 0 ? (
          <EmptyState icon={Hand} title="Nothing waiting" description="All orders have a rider." compact />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {available.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                showCustomer
                footer={<p className="mt-2 text-xs text-muted-foreground">Waiting {formatRelative(o.created_at).replace(" ago", "")}</p>}
                actions={
                  <Button size="sm" variant="soft" disabled={claim.isPending} onClick={() => claim.mutate(o.id)}>
                    <Hand /> Claim order
                  </Button>
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
