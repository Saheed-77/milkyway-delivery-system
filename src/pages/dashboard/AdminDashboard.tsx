
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { useToast } from "@/components/ui/use-toast";
import { Sidebar, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { DashboardContent } from "@/components/admin/DashboardContent";

interface FarmerProfile {
  id: string;
  email: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  farm_name?: string;
  farm_location?: string;
  production_capacity?: number;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [pendingFarmers, setPendingFarmers] = useState<FarmerProfile[]>([]);
  const [approvedFarmers, setApprovedFarmers] = useState<FarmerProfile[]>([]);
  const [activeSection, setActiveSection] = useState("farmers");

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth/admin");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", session.user.id)
        .single();

      if (profile?.user_type !== "admin") {
        navigate("/");
      }
    };

    checkAuth();
    loadFarmers();
  }, [navigate]);

  const loadFarmers = async () => {
    console.log("Loading farmers...");
    const { data: farmers, error } = await supabase
      .from("profiles")
      .select(`
        id,
        email,
        status,
        created_at,
        farmers (
          farm_name,
          farm_location,
          production_capacity
        )
      `)
      .eq("user_type", "farmer")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading farmers:", error);
      toast({
        title: "Error",
        description: "Failed to load farmers",
        variant: "destructive",
      });
      return;
    }

    if (farmers) {
      const transformedFarmers = farmers.map(f => ({
        ...f,
        farm_name: f.farmers?.farm_name,
        farm_location: f.farmers?.farm_location,
        production_capacity: f.farmers?.production_capacity,
      }));

      setPendingFarmers(transformedFarmers.filter(f => f.status === 'pending'));
      setApprovedFarmers(transformedFarmers.filter(f => f.status === 'approved'));
    }
  };

  const handleFarmerStatus = async (farmerId: string, status: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ status })
        .eq("id", farmerId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Farmer ${status === 'approved' ? 'approved' : 'rejected'} successfully`,
      });

      loadFarmers();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update farmer status",
        variant: "destructive",
      });
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-[#f8f7f3]">
        <Sidebar>
          <AdminSidebar 
            activeSection={activeSection} 
            onSectionChange={setActiveSection} 
          />
        </Sidebar>

        <div className="flex-1 p-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-[#437358]">Admin Dashboard</h1>
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <LogoutButton />
            </div>
          </div>
          <DashboardContent
            activeSection={activeSection}
            pendingFarmers={pendingFarmers}
            approvedFarmers={approvedFarmers}
            onApprove={(id) => handleFarmerStatus(id, 'approved')}
            onReject={(id) => handleFarmerStatus(id, 'rejected')}
          />
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AdminDashboard;
