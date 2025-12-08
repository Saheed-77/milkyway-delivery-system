import { useEffect, useState } from "react";
import { Loader2, Monitor, Moon, Save, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { InitialsAvatar } from "@/components/common/Brand";
import { PageHeader } from "@/components/common/PageHeader";
import { LocationPickerField, type PickedLocation } from "@/components/maps/LocationPickerField";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { errorMessage } from "@/hooks/api/core";
import { formatDate, fullName } from "@/lib/format";
import { ROLE_META } from "@/lib/roles";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { profile, updateProfile, isDemo } = useAuth();
  const { theme, setTheme } = useTheme();
  const [form, setForm] = useState({ first_name: "", last_name: "", phone: "", address: "" });
  const [location, setLocation] = useState<PickedLocation | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setForm({
      first_name: profile.first_name ?? "",
      last_name: profile.last_name ?? "",
      phone: profile.phone ?? "",
      address: profile.address ?? "",
    });
    setLocation(profile.latitude != null && profile.longitude != null ? { lat: profile.latitude, lng: profile.longitude, address: profile.address } : null);
  }, [profile]);

  if (!profile) return null;
  const meta = ROLE_META[profile.user_type];
  const needsLocation = profile.user_type === "customer" || profile.user_type === "farmer";

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name.trim()) {
      toast.error("First name is required");
      return;
    }
    if (form.phone && !/^[+]?[\d\s()-]{7,20}$/.test(form.phone.trim())) {
      toast.error("Enter a valid phone number");
      return;
    }
    setSaving(true);
    try {
      await updateProfile({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        ...(needsLocation ? { latitude: location?.lat ?? null, longitude: location?.lng ?? null } : {}),
      });
      toast.success("Profile saved");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Your profile, delivery location and app preferences." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Riders and the MilkyWay team see these details.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={save} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="first">First name</Label>
                  <Input id="first" value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="last">Last name</Label>
                  <Input id="last" value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" value={profile.email} disabled />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="address">{profile.user_type === "farmer" ? "Farm address" : "Address"}</Label>
                <Input id="address" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
              </div>
              {needsLocation && (
                <LocationPickerField
                  value={location}
                  onChange={setLocation}
                  label={profile.user_type === "farmer" ? "Farm location" : "Default delivery location"}
                  hint="Used for new orders and rider navigation"
                />
              )}
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="animate-spin" /> : <Save />} Save changes
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <InitialsAvatar name={fullName(profile)} className="h-14 w-14 text-lg" />
              <div className="min-w-0">
                <p className="truncate font-semibold">{fullName(profile)}</p>
                <p className="text-sm text-muted-foreground">{meta.label} · since {formatDate(profile.created_at)}</p>
                {isDemo && <p className="mt-1 text-xs font-semibold text-info">Demo account</p>}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ["light", Sun, "Light"],
                    ["dark", Moon, "Dark"],
                    ["system", Monitor, "System"],
                  ] as const
                ).map(([value, Icon, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTheme(value)}
                    aria-pressed={theme === value}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-xl border p-3 text-sm font-medium transition-colors",
                      theme === value ? "border-primary bg-primary-soft text-primary" : "hover:bg-muted"
                    )}
                  >
                    <Icon className="h-5 w-5" /> {label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
