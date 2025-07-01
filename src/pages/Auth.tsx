import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AuthForm } from "@/components/auth/AuthForm";
import { useAuth, type UserRole } from "@/contexts/AuthContext";
import { Navbar } from "@/components/layout/Navbar";

const VALID_TYPES: UserRole[] = ["admin", "farmer", "customer", "delivery"];

const Auth = () => {
  const { userType } = useParams<{ userType: string }>();
  const navigate = useNavigate();
  const { session, profile, isLoading } = useAuth();

  const isValidType = VALID_TYPES.includes(userType as UserRole);

  useEffect(() => {
    // Already signed in with a matching role -> go straight to the dashboard.
    if (!isLoading && session && profile && profile.user_type === userType) {
      if (profile.user_type !== "farmer" || profile.status === "approved") {
        navigate(`/dashboard/${profile.user_type}`, { replace: true });
      }
    }
  }, [isLoading, session, profile, userType, navigate]);

  if (!isValidType) {
    return (
      <div className="min-h-screen bg-[#f8f7f3] flex items-center justify-center">
        <p className="text-muted-foreground">Invalid login page.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f7f3] flex flex-col">
      <div className="z-50">
        <Navbar />
      </div>
      <div className="flex-1 flex items-center justify-center">
        <AuthForm userType={userType as UserRole} />
      </div>
    </div>
  );
};

export default Auth;
