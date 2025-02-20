
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { QuickOrderForm } from "@/components/customer/QuickOrderForm";
import { SubscriptionsList } from "@/components/customer/SubscriptionsList";
import { WalletBalance } from "@/components/customer/WalletBalance";
import { OrdersList } from "@/components/customer/OrdersList";

const CustomerDashboard = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth/customer");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", session.user.id)
        .single();

      if (profile?.user_type !== "customer") {
        navigate("/");
      }
    };

    checkAuth();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#f8f7f3] p-4 md:p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#437358]">Customer Dashboard</h1>
          <p className="text-sm text-muted-foreground">Manage your orders, subscriptions and wallet</p>
        </div>
        <LogoutButton />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="md:col-span-1">
          <QuickOrderForm />
        </div>
        <div className="md:col-span-1">
          <WalletBalance />
        </div>
        <div className="md:col-span-1">
          <SubscriptionsList />
        </div>
      </div>

      <div className="mt-6">
        <OrdersList />
      </div>
    </div>
  );
};

export default CustomerDashboard;
