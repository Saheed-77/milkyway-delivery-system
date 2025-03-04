
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { DeliverySidebar } from "@/components/delivery/DeliverySidebar";
import { DeliverySummary } from "@/components/delivery/DeliverySummary";
import { PendingDeliveries } from "@/components/delivery/PendingDeliveries";
import { CompletedDeliveries } from "@/components/delivery/CompletedDeliveries";
import { DeliverySchedule } from "@/components/delivery/DeliverySchedule";
import { SidebarProvider } from "@/components/ui/sidebar";

const DeliveryDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [refreshKey, setRefreshKey] = useState(0);

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
      .select('user_type')
      .eq('id', session.user.id)
      .single();

    if (profile?.user_type !== 'delivery') {
      await supabase.auth.signOut();
      navigate('/auth/delivery');
    }
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
    <div className="flex h-screen bg-[#f8f7f3]">
      <SidebarProvider>
        <DeliverySidebar />
        
        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="border-b border-border bg-white p-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-[#437358]">Delivery Dashboard</h1>
              <Button
                variant="outline"
                onClick={handleSignOut}
                className="text-[#437358]"
              >
                Sign Out
              </Button>
            </div>
          </header>
          
          <main className="flex-1 overflow-y-auto p-6">
            <div className="max-w-7xl mx-auto space-y-6">
              {renderContent()}
            </div>
          </main>
        </div>
      </SidebarProvider>
    </div>
  );
};

export default DeliveryDashboard;
