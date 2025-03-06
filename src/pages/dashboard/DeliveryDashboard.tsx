
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { useToast } from "@/components/ui/use-toast";
import { DeliverySummary } from "@/components/delivery/DeliverySummary";
import { PendingDeliveries } from "@/components/delivery/PendingDeliveries";
import { CompletedDeliveries } from "@/components/delivery/CompletedDeliveries";
import { DeliverySchedule } from "@/components/delivery/DeliverySchedule";
import { SidebarProvider, Sidebar, SidebarInset } from "@/components/ui/sidebar";
import { Navbar } from "@/components/layout/Navbar";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";

const DeliveryDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [refreshKey, setRefreshKey] = useState(0);
  const [deliveryProfile, setDeliveryProfile] = useState<any>(null);

  useEffect(() => {
    checkUser();
  }, [navigate]);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate('/auth/delivery');
      return;
    }

    // Check if user is a delivery person
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_type, first_name, last_name')
      .eq('id', session.user.id)
      .single();

    if (profile?.user_type !== 'delivery') {
      await supabase.auth.signOut();
      navigate('/auth/delivery');
      return;
    }

    setDeliveryProfile(profile);
  };

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      toast({
        title: "Signed out successfully",
        description: "You have been logged out of your account.",
      });
      
      navigate('/auth/delivery');
    } catch (error) {
      toast({
        title: "Error signing out",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleStatusChange = () => {
    setRefreshKey(prev => prev + 1);
  };

  // Determine which section to show based on the route
  const getActiveSection = () => {
    const path = location.pathname;
    
    if (path.includes('/pending')) {
      return 'pending';
    } else if (path.includes('/completed')) {
      return 'completed';
    } else if (path.includes('/schedule')) {
      return 'schedule';
    } else if (path.includes('/settings')) {
      return 'settings';
    } else {
      return 'overview';
    }
  };

  const renderContent = () => {
    const activeSection = getActiveSection();
    
    switch (activeSection) {
      case 'pending':
        return <PendingDeliveries onStatusChange={handleStatusChange} />;
      case 'completed':
        return <CompletedDeliveries />;
      case 'schedule':
        return <DeliverySchedule />;
      default:
        return (
          <div className="space-y-6">
            <DeliverySummary key={refreshKey} />
            <PendingDeliveries onStatusChange={handleStatusChange} />
          </div>
        );
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
                userType="delivery" 
                activeSection={getActiveSection()}
              />
            </Sidebar>
            
            <SidebarInset>
              <div className="min-h-screen">
                <header className="border-b border-border bg-white p-4">
                  <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-[#437358]">
                      {deliveryProfile?.first_name 
                        ? `Welcome, ${deliveryProfile.first_name}` 
                        : 'Delivery Dashboard'}
                    </h1>
                    <LogoutButton />
                  </div>
                </header>
                
                <main className="flex-1 overflow-y-auto p-6">
                  <div className="max-w-7xl mx-auto space-y-6">
                    {renderContent()}
                  </div>
                </main>
              </div>
            </SidebarInset>
          </div>
        </SidebarProvider>
      </div>
    </div>
  );
};

export default DeliveryDashboard;
