import { useNavigate } from "react-router-dom";
import { FlaskConical, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { ROLE_META, ROLES } from "@/lib/roles";
import { resetDemoData } from "@/services/mock/mockApi";
import type { UserRole } from "@/services";

/** Persistent strip in demo mode: what's going on, quick role switching and reset. */
export function DemoBanner() {
  const { profile, demoSignIn } = useAuth();
  const navigate = useNavigate();

  const switchTo = async (role: UserRole) => {
    await demoSignIn(role);
    navigate(`/dashboard/${role}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b bg-accent px-4 py-1.5 text-xs text-accent-foreground sm:px-6">
      <span className="flex items-center gap-1.5 font-semibold">
        <FlaskConical className="h-3.5 w-3.5" /> Demo mode
      </span>
      <span className="hidden text-accent-foreground/80 md:inline">Data lives in this browser · riders move by simulation</span>
      <div className="ml-auto flex flex-wrap items-center gap-1">
        <span className="hidden sm:inline">Switch role:</span>
        {ROLES.filter((r) => r !== profile?.user_type).map((role) => (
          <Button key={role} size="xs" variant="ghost" className="h-6 px-2 text-accent-foreground hover:bg-card/60" onClick={() => switchTo(role)}>
            {ROLE_META[role].label}
          </Button>
        ))}
        <ConfirmDialog
          trigger={
            <Button size="xs" variant="ghost" className="h-6 px-2 text-accent-foreground hover:bg-card/60">
              <RotateCcw className="!size-3" /> Reset
            </Button>
          }
          title="Reset demo data?"
          description="Restores the original farmers, orders and riders. Anything you created in this browser is removed."
          confirmLabel="Reset data"
          variant="destructive"
          onConfirm={() => {
            resetDemoData();
            toast.success("Demo data reset");
          }}
        />
      </div>
    </div>
  );
}
