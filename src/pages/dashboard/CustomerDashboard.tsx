
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { QuickOrderForm } from "@/components/customer/QuickOrderForm";
import { SubscriptionsList } from "@/components/customer/SubscriptionsList";
import { WalletBalance } from "@/components/customer/WalletBalance";
import { OrdersList } from "@/components/customer/OrdersList";
import { TransactionHistory } from "@/components/customer/TransactionHistory";
import { Navbar } from "@/components/layout/Navbar";
import { SidebarProvider, Sidebar, SidebarInset } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";

const CustomerDashboard = () => {
  const navigate = useNavigate();
  const [customerProfile, setCustomerProfile] = useState<any>(null);
  const [activeSection, setActiveSection] = useState("orders");
  const [refreshOrdersTrigger, setRefreshOrdersTrigger] = useState(0);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth/customer");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("user_type, first_name, last_name")
        .eq("id", session.user.id)
        .single();

      if (profile?.user_type !== "customer") {
        navigate("/");
        return;
      }

      setCustomerProfile({
        ...profile,
        id: session.user.id
      });
    };

    checkAuth();
  }, [navigate]);

  const handleOrderComplete = () => {
    // Trigger a refresh of the orders list
    setRefreshOrdersTrigger(prev => prev + 1);
  };

  const renderActiveSection = () => {
    switch (activeSection) {
      case "orders":
        return (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              <div className="md:col-span-1">
                <QuickOrderForm onOrderComplete={handleOrderComplete} />
              </div>
              <div className="md:col-span-1">
                <WalletBalance refreshTrigger={refreshOrdersTrigger} />
              </div>
              <div className="md:col-span-1">
                <SubscriptionsList />
              </div>
            </div>

            <div className="mt-6">
              <OrdersList refreshTrigger={refreshOrdersTrigger} />
            </div>
          </>
        );
      case "wallet":
        return (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              <div className="md:col-span-1">
                <WalletBalance refreshTrigger={refreshOrdersTrigger} />
              </div>
              <div className="md:col-span-2">
                <TransactionHistory refreshTrigger={refreshOrdersTrigger} />
              </div>
            </div>
          </>
        );
      case "subscriptions":
        return <SubscriptionsList />;
      case "transactions":
        return <TransactionHistory refreshTrigger={refreshOrdersTrigger} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f8f7f3]">
      <div className="fixed top-0 left-0 right-0 z-50">
        <Navbar showAuthButtons={false} />
      </div>
      
      <div className="pt-16 flex-1 flex">
        <SidebarProvider>
          <div className="flex-1 flex w-full">
            <Sidebar>
              <DashboardSidebar 
                userType="customer" 
                activeSection={activeSection} 
                onSectionChange={setActiveSection} 
              />
            </Sidebar>
            <SidebarInset>
              <div className="min-h-screen p-4 md:p-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-3">
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-[#437358]">
                      {customerProfile?.first_name ? `Welcome, ${customerProfile.first_name}` : 'Customer Dashboard'}
                    </h1>
                    <p className="text-sm text-muted-foreground">Manage your orders, subscriptions and wallet</p>
                  </div>
                  <LogoutButton />
                </div>
                
                {renderActiveSection()}
              </div>
            </SidebarInset>
          </div>
        </SidebarProvider>
      </div>
    </div>
  );
};

export default CustomerDashboard;
