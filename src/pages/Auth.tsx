import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AuthForm } from "@/components/auth/AuthForm";
import { FullPageLoader } from "@/components/auth/ProtectedRoute";
import { Logo } from "@/components/common/Brand";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth, type UserRole } from "@/contexts/AuthContext";
import { errorMessage } from "@/hooks/api/core";
import { isRole, ROLE_META, ROLES } from "@/lib/roles";
import { cn } from "@/lib/utils";

const HIGHLIGHTS: Record<UserRole, string[]> = {
  customer: ["Morning delivery from local farms", "Live rider tracking with OTP hand-off", "Daily, weekly or monthly subscriptions"],
  farmer: ["Daily collection with instant quality feedback", "Fair, date-based pricing per litre", "Request payouts straight to your wallet"],
  delivery: ["Optimised multi-stop routes", "One-tap navigation in Google Maps", "Secure OTP proof of delivery"],
  admin: ["Live dispatch map of every rider", "Inventory, reservations and archives", "Farmer approvals and payment reviews"],
};

function DemoAccess({ current }: { current: UserRole }) {
  const { demoSignIn } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<UserRole | null>(null);

  const enter = async (role: UserRole) => {
    setBusy(role);
    try {
      const p = await demoSignIn(role);
      toast.success(`Signed in as ${p.first_name} (${ROLE_META[role].label})`);
      navigate(`/dashboard/${role}`, { replace: true });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="border-primary/30 bg-primary-soft/40 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
        <Sparkles className="h-4 w-4" /> Demo mode — explore any role instantly
      </div>
      <div className="grid grid-cols-2 gap-2">
        {ROLES.map((role) => {
          const meta = ROLE_META[role];
          const Icon = meta.icon;
          return (
            <Button
              key={role}
              variant={role === current ? "default" : "outline"}
              className="h-auto justify-start py-2.5"
              disabled={!!busy}
              onClick={() => enter(role)}
            >
              {busy === role ? <Loader2 className="animate-spin" /> : <Icon />}
              <span className="truncate">Enter as {meta.label}</span>
            </Button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        No backend needed: data lives in your browser and resets daily. Any password works for demo emails.
      </p>
    </Card>
  );
}

const Auth = () => {
  const { userType } = useParams<{ userType: string }>();
  const { profile, isLoading, isDemo } = useAuth();

  if (!isRole(userType)) return <Navigate to="/auth/customer" replace />;
  if (isLoading) return <FullPageLoader />;
  if (profile?.user_type === userType && (userType !== "farmer" || profile.status === "approved")) {
    return <Navigate to={`/dashboard/${userType}`} replace />;
  }

  const meta = ROLE_META[userType];
  const Icon = meta.icon;

  return (
    <div className="grid min-h-svh lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-primary text-primary-foreground lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="bg-dots absolute inset-0 opacity-30" aria-hidden />
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-[hsl(208_72%_70%/0.25)] blur-3xl" aria-hidden />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-[hsl(48_60%_90%/0.18)] blur-3xl" aria-hidden />
        <Logo className="relative text-primary-foreground [&_span_span]:text-[hsl(208_72%_86%)]" />
        <div className="relative space-y-6">
          <span className={cn("inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm font-semibold")}>
            <Icon className="h-4 w-4" /> {meta.label} portal
          </span>
          <h1 className="max-w-md text-4xl font-extrabold leading-tight">{meta.tagline}</h1>
          <ul className="space-y-3">
            {HIGHLIGHTS[userType].map((h) => (
              <li key={h} className="flex items-center gap-3 text-primary-foreground/90">
                <CheckCircle2 className="h-5 w-5 text-[hsl(208_72%_86%)]" /> {h}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-primary-foreground/70">Fresh from local farms around Kochi · since 2025</p>
      </aside>

      {/* Form panel */}
      <main className="flex flex-col px-4 py-6 sm:px-8">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/">
              <ArrowLeft /> Home
            </Link>
          </Button>
          <div className="lg:hidden">
            <Logo compact />
          </div>
          <ThemeToggle />
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 py-8">
          <nav aria-label="Choose portal" className="grid grid-cols-4 gap-1 rounded-xl bg-muted p-1">
            {ROLES.map((role) => (
              <Link
                key={role}
                to={`/auth/${role}`}
                className={cn(
                  "rounded-lg px-2 py-1.5 text-center text-xs font-semibold transition-colors sm:text-sm",
                  role === userType ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
                aria-current={role === userType ? "page" : undefined}
              >
                {ROLE_META[role].label}
              </Link>
            ))}
          </nav>

          {isDemo && <DemoAccess current={userType} />}

          <Card className="p-6 sm:p-8">
            <AuthForm key={userType} userType={userType} />
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Auth;
