
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { DeliverySidebar } from "@/components/delivery/DeliverySidebar";
import { DeliverySummary } from "@/components/delivery/DeliverySummary";
import { PendingDeliveries } from "@/components/delivery/PendingDeliveries";
import { SidebarProvider } from "@/components/ui/sidebar";

const DeliveryDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
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

    checkUser();
  }, [navigate]);

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
              <DeliverySummary />
              <PendingDeliveries />
            </div>
          </main>
        </div>
      </SidebarProvider>
    </div>
  );
};

export default DeliveryDashboard;
