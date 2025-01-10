
import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AuthForm } from "@/components/auth/AuthForm";
import { supabase } from "@/integrations/supabase/client";

const Auth = () => {
  const { userType } = useParams<{ userType: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/dashboard");
      }
    };
    checkAuth();
  }, [navigate]);

  if (!["admin", "farmer", "customer"].includes(userType)) {
    return <div>Invalid user type</div>;
  }

  return (
    <div className="min-h-screen bg-[#f8f7f3] flex flex-col items-center justify-center">
      <AuthForm userType={userType as "admin" | "farmer" | "customer"} />
    </div>
  );
};

export default Auth;
