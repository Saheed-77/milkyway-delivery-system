
import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AuthForm } from "@/components/auth/AuthForm";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

const Auth = () => {
  const { userType } = useParams<{ userType: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkAuthAndUserType = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // Get user profile to check user type
        const { data: profile } = await supabase
          .from("profiles")
          .select("user_type")
          .eq("id", session.user.id)
          .single();

        if (profile?.user_type !== userType) {
          // If user is logged in but trying to access wrong auth page, log them out
          await supabase.auth.signOut();
          toast({
            title: "Access Denied",
            description: "Please log in with the correct user type.",
            variant: "destructive",
          });
          return;
        }

        // If user is already logged in with correct type, redirect to dashboard
        navigate(`/dashboard/${profile.user_type}`);
      }
    };

    checkAuthAndUserType();
  }, [navigate, userType, toast]);

  if (!["admin", "farmer", "customer", "delivery"].includes(userType)) {
    return <div>Invalid user type</div>;
  }

  return (
    <div className="min-h-screen bg-[#f8f7f3] flex flex-col items-center justify-center">
      <AuthForm userType={userType as "admin" | "farmer" | "customer" | "delivery"} />
    </div>
  );
};

export default Auth;
