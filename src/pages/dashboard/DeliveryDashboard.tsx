
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Truck } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

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
    <div className="min-h-screen bg-[#f8f7f3] p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-[#437358]">Delivery Dashboard</h1>
          <Button
            variant="outline"
            onClick={handleSignOut}
            className="text-[#437358]"
          >
            Sign Out
          </Button>
        </div>
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <Truck className="w-16 h-16 text-[#437358] mx-auto mb-4" />
          <h2 className="text-2xl font-semibold mb-4">Welcome to your Delivery Dashboard</h2>
          <p className="text-gray-600">
            Your delivery management interface is coming soon. Here you'll be able to:
          </p>
          <ul className="mt-4 space-y-2 text-gray-600">
            <li>• View assigned deliveries</li>
            <li>• Update delivery status</li>
            <li>• Access customer locations</li>
            <li>• Track your delivery performance</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default DeliveryDashboard;
