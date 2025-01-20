
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Check, X, Users, Milk, Calendar, MessageSquare, Truck, ChartBar } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

    console.log("Fetched farmers:", farmers);

    if (farmers) {
      // Transform the data to flatten the farmers object
      const transformedFarmers = farmers.map(f => ({
        ...f,
        farm_name: f.farmers?.farm_name,
        farm_location: f.farmers?.farm_location,
        production_capacity: f.farmers?.production_capacity,
      }));

      const pending = transformedFarmers.filter(f => f.status === 'pending');
      const approved = transformedFarmers.filter(f => f.status === 'approved');
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pending Farmers */}
            <Card>
              <CardHeader>
                <CardTitle>Pending Farmer Registrations</CardTitle>
                <CardDescription>Review and approve new farmer applications</CardDescription>
              </CardHeader>
              <CardContent>
                {pendingFarmers.length === 0 ? (
                  <p className="text-gray-500">No pending registrations</p>
                ) : (
                  <div className="space-y-4">
                    {pendingFarmers.map((farmer) => (
                      <div key={farmer.id} className="border p-4 rounded-lg">
                        <p className="font-medium">{farmer.email}</p>
                        {farmer.farm_name && (
                          <p className="text-sm text-gray-600">Farm: {farmer.farm_name}</p>
                        )}
                        {farmer.farm_location && (
                          <p className="text-sm text-gray-600">Location: {farmer.farm_location}</p>
                        )}
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
              </CardContent>
            </Card>

            {/* Approved Farmers */}
            <Card>
              <CardHeader>
                <CardTitle>Approved Farmers</CardTitle>
                <CardDescription>View all approved farmer profiles</CardDescription>
              </CardHeader>
              <CardContent>
                {approvedFarmers.length === 0 ? (
                  <p className="text-gray-500">No approved farmers</p>
                ) : (
                  <div className="space-y-4">
                    {approvedFarmers.map((farmer) => (
                      <div key={farmer.id} className="border p-4 rounded-lg">
                        <p className="font-medium">{farmer.email}</p>
                        {farmer.farm_name && (
                          <p className="text-sm text-gray-600">Farm: {farmer.farm_name}</p>
                        )}
                        {farmer.farm_location && (
                          <p className="text-sm text-gray-600">Location: {farmer.farm_location}</p>
                        )}
                        {farmer.production_capacity && (
                          <p className="text-sm text-gray-600">
                            Capacity: {farmer.production_capacity} liters/day
                          </p>
                        )}
                        <p className="text-sm text-gray-500">
                          Approved: {new Date(farmer.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );
      case "collections":
        return (
          <Card>
            <CardHeader>
              <CardTitle>Milk Collections & Distribution</CardTitle>
              <CardDescription>Monitor milk collections and schedules</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500">Coming soon: Monitor milk collections and schedules</p>
            </CardContent>
          </Card>
        );
      case "orders":
        return (
          <Card>
            <CardHeader>
              <CardTitle>Customer Orders & Feedback</CardTitle>
              <CardDescription>Handle customer orders and feedback</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500">Coming soon: Handle customer orders and feedback</p>
            </CardContent>
          </Card>
        );
      case "delivery":
        return (
          <Card>
            <CardHeader>
              <CardTitle>Delivery Management</CardTitle>
              <CardDescription>Track delivery personnel and assignments</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500">Coming soon: Track delivery personnel and assignments</p>
            </CardContent>
          </Card>
        );
      case "reports":
        return (
          <Card>
            <CardHeader>
              <CardTitle>Reports & Analytics</CardTitle>
              <CardDescription>Generate reports on sales and deliveries</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500">Coming soon: Generate reports on sales and deliveries</p>
            </CardContent>
          </Card>
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
