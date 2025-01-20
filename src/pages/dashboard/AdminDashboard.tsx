import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Check, X, Users, Milk, Calendar, MessageSquare, Truck, ChartBar } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

interface FarmerProfile {
  id: string;
  email: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
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
      .select("id, email, status, created_at")
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

    console.log("Fetched farmers:", farmers);

    if (farmers) {
      const pending = farmers.filter(f => f.status === 'pending');
      const approved = farmers.filter(f => f.status === 'approved');
      console.log("Pending farmers:", pending);
      console.log("Approved farmers:", approved);
      setPendingFarmers(pending);
      setApprovedFarmers(approved);
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

  const renderContent = () => {
    switch (activeSection) {
      case "farmers":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pending Farmers */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold mb-4">Pending Farmer Registrations</h2>
              {pendingFarmers.length === 0 ? (
                <p className="text-gray-500">No pending registrations</p>
              ) : (
                <div className="space-y-4">
                  {pendingFarmers.map((farmer) => (
                    <div key={farmer.id} className="border p-4 rounded-lg">
                      <p className="font-medium">{farmer.email}</p>
                      <p className="text-sm text-gray-500">
                        Registered: {new Date(farmer.created_at).toLocaleDateString()}
                      </p>
                      <div className="mt-2 flex gap-2">
                        <Button
                          size="sm"
                          className="bg-green-500 hover:bg-green-600"
                          onClick={() => handleFarmerStatus(farmer.id, 'approved')}
                        >
                          <Check className="w-4 h-4 mr-1" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleFarmerStatus(farmer.id, 'rejected')}
                        >
                          <X className="w-4 h-4 mr-1" /> Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Approved Farmers */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold mb-4">Approved Farmers</h2>
              {approvedFarmers.length === 0 ? (
                <p className="text-gray-500">No approved farmers</p>
              ) : (
                <div className="space-y-4">
                  {approvedFarmers.map((farmer) => (
                    <div key={farmer.id} className="border p-4 rounded-lg">
                      <p className="font-medium">{farmer.email}</p>
                      <p className="text-sm text-gray-500">
                        Approved: {new Date(farmer.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      case "collections":
        return (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Milk Collections & Distribution</h2>
            <p className="text-gray-500">Coming soon: Monitor milk collections and schedules</p>
          </div>
        );
      case "orders":
        return (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Customer Orders & Feedback</h2>
            <p className="text-gray-500">Coming soon: Handle customer orders and feedback</p>
          </div>
        );
      case "delivery":
        return (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Delivery Management</h2>
            <p className="text-gray-500">Coming soon: Track delivery personnel and assignments</p>
          </div>
        );
      case "reports":
        return (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Reports & Analytics</h2>
            <p className="text-gray-500">Coming soon: Generate reports on sales and deliveries</p>
          </div>
        );
      default:
        return null;
    }
  };

  const menuItems = [
    { id: "farmers", title: "Farmer Management", icon: Users },
    { id: "collections", title: "Milk Collections", icon: Milk },
    { id: "orders", title: "Customer Orders", icon: MessageSquare },
    { id: "delivery", title: "Delivery Management", icon: Truck },
    { id: "reports", title: "Reports & Analytics", icon: ChartBar },
  ];

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-[#f8f7f3]">
        <Sidebar>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Admin Dashboard</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {menuItems.map((item) => (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        onClick={() => setActiveSection(item.id)}
                        className={activeSection === item.id ? "bg-gray-100" : ""}
                      >
                        <item.icon className="w-4 h-4 mr-2" />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <div className="flex-1 p-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-[#437358]">Admin Dashboard</h1>
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <LogoutButton />
            </div>
          </div>
          {renderContent()}
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AdminDashboard;
