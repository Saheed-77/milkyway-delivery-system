import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { LogoMark } from "@/components/common/Brand";
import { useAuth, type UserRole } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  role: UserRole;
  children: ReactNode;
}

export function FullPageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="grid min-h-svh place-items-center bg-background">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <LogoMark className="h-12 w-12 animate-pulse" />
        <p className="text-sm">{label}</p>
      </div>
    </div>
  );
}

/** Blocks rendering (and data fetching) until the session and role are verified. */
export const ProtectedRoute = ({ role, children }: ProtectedRouteProps) => {
  const { profile, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <FullPageLoader />;

  if (!profile) {
    return <Navigate to={`/auth/${role}`} replace state={{ from: location.pathname }} />;
  }

  if (profile.user_type !== role) {
    // signed in with another role: send them to their own dashboard
    return <Navigate to={`/dashboard/${profile.user_type}`} replace />;
  }

  if (role === "farmer" && profile.status !== "approved") {
    return <Navigate to="/auth/farmer" replace />;
  }

  return <>{children}</>;
};
