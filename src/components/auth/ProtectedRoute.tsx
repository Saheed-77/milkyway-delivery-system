import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth, type UserRole } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  role: UserRole;
  children: ReactNode;
}

export const ProtectedRoute = ({ role, children }: ProtectedRouteProps) => {
  const { session, profile, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f7f3]">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to={`/auth/${role}`} replace />;
  }

  if (!profile || profile.user_type !== role) {
    return <Navigate to="/" replace />;
  }

  if (role === "farmer" && profile.status !== "approved") {
    return <Navigate to={`/auth/farmer`} replace />;
  }

  return <>{children}</>;
};
