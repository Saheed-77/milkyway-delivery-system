import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { setFarmerStatus, getTodayStockSummary, getLatestMilkStock } from "@/lib/rpc";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { useToast } from "@/components/ui/use-toast";
import { Sidebar, SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { DashboardContent } from "@/components/admin/DashboardContent";
import { Navbar } from "@/components/layout/Navbar";

interface FarmerProfile {
  id: string;
  email: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  farm_name?: string;
  farm_location?: string;
  production_capacity?: number;
  first_name?: string;
  last_name?: string;
  phone?: string;
  address?: string;
  farmer_id?: string;
}

const AdminDashboard = () => {
  // Access control is handled by <ProtectedRoute role="admin"> in App.tsx.
  const { profile: adminProfile } = useAuth();
  const { toast } = useToast();
  const [pendingFarmers, setPendingFarmers] = useState<FarmerProfile[]>([]);
  const [approvedFarmers, setApprovedFarmers] = useState<FarmerProfile[]>([]);
  const [activeSection, setActiveSection] = useState("dashboard");
  const [totalMilkStock, setTotalMilkStock] = useState(0);
  const [availableStock, setAvailableStock] = useState(0);
  const [soldStock, setSoldStock] = useState(0);
  const [subscriptionDemand, setSubscriptionDemand] = useState(0);

  const loadMilkStock = useCallback(async () => {
    try {
      const summary = await getTodayStockSummary();
      if (summary) {
        setTotalMilkStock(summary.total_stock ?? 0);
        setAvailableStock(summary.available_stock ?? 0);
        setSoldStock(summary.sold_stock ?? 0);
        setSubscriptionDemand(summary.subscription_demand ?? 0);
        return;
      }

      const latest = await getLatestMilkStock();
      if (latest) {
        setTotalMilkStock(latest.total_stock ?? 0);
        setAvailableStock(latest.available_stock ?? 0);
        setSubscriptionDemand(latest.subscription_demand ?? 0);
      }
    } catch (error) {
      console.error("Error loading milk stock:", error);
      toast({
        title: "Error",
        description: "Failed to load milk stock data",
        variant: "destructive",
      });
    }
  }, [toast]);

  const loadFarmers = useCallback(async () => {
    const { data: farmersData, error } = await supabase
      .from("profiles")
      .select(
        `
        id,
        email,
        status,
        created_at,
        first_name,
        last_name,
        phone,
        address,
        farmers (
          farm_name,
          farm_location,
          production_capacity,
          farmer_id
        )
      `
      )
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

    const transformed: FarmerProfile[] = (farmersData ?? []).map((f) => {
      const farmerRow = Array.isArray(f.farmers) ? f.farmers[0] : f.farmers;
      return {
        id: f.id,
        email: f.email || "",
        status: (f.status as FarmerProfile["status"]) || "pending",
        created_at: f.created_at,
        first_name: f.first_name || "",
        last_name: f.last_name || "",
        phone: f.phone || "",
        address: f.address || "",
        farm_name: farmerRow?.farm_name ?? undefined,
        farm_location: farmerRow?.farm_location ?? undefined,
        production_capacity: farmerRow?.production_capacity ?? undefined,
        farmer_id: farmerRow?.farmer_id?.toString(),
      };
    });

    setPendingFarmers(transformed.filter((f) => f.status === "pending"));
    setApprovedFarmers(transformed.filter((f) => f.status === "approved"));
  }, [toast]);

  useEffect(() => {
    void loadFarmers();
    void loadMilkStock();
  }, [loadFarmers, loadMilkStock]);

  const handleFarmerStatus = async (farmerId: string, status: "approved" | "rejected") => {
    try {
      // Admin-only server-side RPC; a compromised client can't approve itself.
      await setFarmerStatus(farmerId, status);

      toast({
        title: "Success",
        description: `Farmer ${status === "approved" ? "approved" : "rejected"} successfully`,
      });

      await loadFarmers();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update farmer status";
      toast({ title: "Error", description: message, variant: "destructive" });
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
                userType="admin"
                activeSection={activeSection}
                onSectionChange={setActiveSection}
              />
            </Sidebar>
            <SidebarInset>
              <div className="min-h-screen p-4 md:p-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-3">
                  <h1 className="text-2xl md:text-3xl font-bold text-[#437358]">
                    {adminProfile?.first_name
                      ? `Welcome, ${adminProfile.first_name}`
                      : "Admin Dashboard"}
                  </h1>
                  <LogoutButton />
                </div>
                <DashboardContent
                  activeSection={activeSection}
                  pendingFarmers={pendingFarmers}
                  approvedFarmers={approvedFarmers}
                  totalMilkStock={totalMilkStock}
                  availableStock={availableStock}
                  soldStock={soldStock}
                  subscriptionDemand={subscriptionDemand}
                  onApprove={(id) => handleFarmerStatus(id, "approved")}
                  onReject={(id) => handleFarmerStatus(id, "rejected")}
                />
              </div>
            </SidebarInset>
          </div>
        </SidebarProvider>
      </div>
    </div>
  );
};

export default AdminDashboard;
