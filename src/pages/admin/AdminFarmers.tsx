import { useMemo, useState } from "react";
import { Ban, CheckCircle2, Loader2, MapPin, Phone, RotateCcw, Search, UserPlus, Users } from "lucide-react";
import { InitialsAvatar } from "@/components/common/Brand";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState, ErrorState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { ListSkeleton } from "@/components/common/Skeletons";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCreateFarmer, useFarmers, useSetFarmerStatus } from "@/hooks/api/queries";
import { formatDate } from "@/lib/format";
import type { AccountStatus, Farmer } from "@/services";

function RegisterFarmerDialog() {
  const [open, setOpen] = useState(false);
  const create = useCreateFarmer();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", farmName: "", farmLocation: "", capacity: "", password: "" });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const valid =
    form.firstName.trim() && form.lastName.trim() && /\S+@\S+\.\S+/.test(form.email) && form.farmName.trim() && form.password.length >= 8;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    create.mutate(
      {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone || undefined,
        farmName: form.farmName,
        farmLocation: form.farmLocation || undefined,
        productionCapacity: form.capacity ? Number(form.capacity) : null,
        password: form.password,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setForm({ firstName: "", lastName: "", email: "", phone: "", farmName: "", farmLocation: "", capacity: "", password: "" });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus /> Register farmer
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle>Register a farmer</DialogTitle>
          <DialogDescription>Creates an approved farmer account with a temporary password they can change later.</DialogDescription>
        </DialogHeader>
        <form id="register-farmer" onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(
            [
              ["firstName", "First name", "text"],
              ["lastName", "Last name", "text"],
              ["email", "Email", "email"],
              ["phone", "Phone", "tel"],
              ["farmName", "Farm name", "text"],
              ["farmLocation", "Farm location", "text"],
              ["capacity", "Daily capacity (L)", "number"],
              ["password", "Temporary password (8+)", "text"],
            ] as const
          ).map(([k, label, type]) => (
            <div key={k} className="space-y-1.5">
              <Label htmlFor={`rf-${k}`}>{label}</Label>
              <Input id={`rf-${k}`} type={type} value={form[k]} onChange={set(k)} autoComplete="off" />
            </div>
          ))}
        </form>
        <DialogFooter>
          <Button type="submit" form="register-farmer" disabled={!valid || create.isPending}>
            {create.isPending && <Loader2 className="animate-spin" />}
            Create account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FarmerCard({ farmer }: { farmer: Farmer }) {
  const setStatus = useSetFarmerStatus();
  const act = (status: AccountStatus) => setStatus.mutateAsync({ id: farmer.id, status });
  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start gap-3">
        <InitialsAvatar name={farmer.name} className="h-12 w-12" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{farmer.name}</p>
          <p className="truncate text-sm text-muted-foreground">{farmer.farm_name}</p>
          <p className="font-mono text-xs text-muted-foreground">ID #{farmer.farmer_code}</p>
        </div>
        <StatusBadge status={farmer.status} label={farmer.status === "rejected" ? "Blacklisted" : undefined} />
      </div>
      <dl className="mt-4 space-y-1.5 text-sm text-muted-foreground">
        {farmer.farm_location && (
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5" /> {farmer.farm_location}
          </div>
        )}
        {farmer.phone && (
          <div className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5" /> {farmer.phone}
          </div>
        )}
        <div className="text-xs">
          Joined {formatDate(farmer.created_at)}
          {farmer.production_capacity ? ` · ~${farmer.production_capacity} L/day` : ""}
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
        {farmer.status !== "approved" && (
          <Button size="sm" variant="success" disabled={setStatus.isPending} onClick={() => act("approved")}>
            {farmer.status === "rejected" ? <RotateCcw /> : <CheckCircle2 />}
            {farmer.status === "rejected" ? "Reinstate" : "Approve"}
          </Button>
        )}
        {farmer.status !== "rejected" && (
          <ConfirmDialog
            trigger={
              <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive-soft hover:text-destructive">
                <Ban /> {farmer.status === "pending" ? "Reject" : "Blacklist"}
              </Button>
            }
            title={`${farmer.status === "pending" ? "Reject" : "Blacklist"} ${farmer.name}?`}
            description="They won't be able to sign in or supply milk until reinstated."
            confirmLabel={farmer.status === "pending" ? "Reject" : "Blacklist"}
            variant="destructive"
            onConfirm={() => act("rejected")}
          />
        )}
      </div>
    </Card>
  );
}

export default function AdminFarmers() {
  const { data = [], isLoading, error, refetch } = useFarmers();
  const [tab, setTab] = useState<AccountStatus>("pending");
  const [query, setQuery] = useState("");
  const counts = { pending: 0, approved: 0, rejected: 0 } as Record<AccountStatus, number>;
  data.forEach((f) => counts[f.status]++);

  // The blacklist is built from *all* farmers; it used to be filtered from approved ones and was always empty.
  const rows = useMemo(() => {
    const t = query.trim().toLowerCase();
    return data.filter((f) => f.status === tab && (!t || `${f.name} ${f.farm_name} ${f.farmer_code} ${f.farm_location}`.toLowerCase().includes(t)));
  }, [data, tab, query]);

  return (
    <div className="space-y-6">
      <PageHeader title="Farmers" description="Approve registrations, manage suppliers and handle quality blacklists." actions={<RegisterFarmerDialog />} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={tab} onValueChange={(v) => setTab(v as AccountStatus)}>
          <TabsList>
            <TabsTrigger value="pending">Pending ({counts.pending})</TabsTrigger>
            <TabsTrigger value="approved">Active ({counts.approved})</TabsTrigger>
            <TabsTrigger value="rejected">Blacklisted ({counts.rejected})</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, farm, ID" className="w-full pl-9 sm:w-64" />
        </div>
      </div>
      {isLoading ? (
        <ListSkeleton />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title={tab === "pending" ? "No registrations waiting" : tab === "rejected" ? "No blacklisted farmers" : "No farmers found"}
          compact
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((f) => (
            <FarmerCard key={f.id} farmer={f} />
          ))}
        </div>
      )}
    </div>
  );
}
