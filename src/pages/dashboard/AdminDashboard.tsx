import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { useToast } from "@/components/ui/use-toast";
import { Sidebar, SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { DashboardContent } from "@/components/admin/DashboardContent";
import { Navbar } from "@/components/layout/Navbar";

interface FarmerProfile {
  id: string;
  email: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  farm_name?: string;
  farm_location?: string;
  production_capacity?: number;
}

// Add a proper interface for the milk_stock table
interface MilkStockRecord {
  total_stock: number;
  available_stock: number;
  subscription_demand: number;
  leftover_milk: number;
  date: string;
}

interface MilkStock {
  total_stock: number;
  available_stock?: number;
  sold_stock?: number;
  subscription_demand?: number;
}

// Add new types to support the new inventory tables
declare module '@supabase/supabase-js' {
  interface SupabaseClient {
    rpc<T = any>(
      fn: string,
      params?: object,
      options?: { head?: boolean, count?: null | 'exact' | 'planned' | 'estimated' }
    ): { data: T; error: Error | null };
  }
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [pendingFarmers, setPendingFarmers] = useState<FarmerProfile[]>([]);
  const [approvedFarmers, setApprovedFarmers] = useState<FarmerProfile[]>([]);
  const [activeSection, setActiveSection] = useState("dashboard");
  const [totalMilkStock, setTotalMilkStock] = useState<number>(0);
  const [availableStock, setAvailableStock] = useState<number>(0);
  const [soldStock, setSoldStock] = useState<number>(0);
  const [subscriptionDemand, setSubscriptionDemand] = useState<number>(0);
  const [adminProfile, setAdminProfile] = useState<any>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth/admin");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("user_type, first_name, last_name")
        .eq("id", session.user.id)
        .single();

      if (profile?.user_type !== "admin") {
        navigate("/");
        return;
      }

      setAdminProfile(profile);
    };

    checkAuth();
    loadFarmers();
    loadMilkStock();
  }, [navigate]);

  const loadMilkStock = async () => {
    try {
      // Try to get today's stock summary first
      const { data: summaryData, error: summaryError } = await supabase
        .rpc('get_today_stock_summary');
      
      if (!summaryError && Array.isArray(summaryData) && summaryData.length > 0) {
        const summary = summaryData[0];
        setTotalMilkStock(summary.total_stock || 0);
        setAvailableStock(summary.available_stock || 0);
        setSoldStock(summary.sold_stock || 0);
        setSubscriptionDemand(summary.subscription_demand || 0);
        return;
      }
      
      // Fallback to getting latest milk stock directly
      const { data: latestStockData, error: latestStockError } = await supabase
        .rpc('get_latest_milk_stock');
        
      if (!latestStockError && Array.isArray(latestStockData) && latestStockData.length > 0) {
        const latestStock = latestStockData[0] as MilkStockRecord;
        setTotalMilkStock(latestStock.total_stock || 0);
        setAvailableStock(latestStock.available_stock || 0);
        setSubscriptionDemand(latestStock.subscription_demand || 0);
        return;
      }
      
      // Final fallback to regular stock query if both functions fail
      const { data, error } = await supabase
        .from('milk_stock')
        .select('*')
        .order('date', { ascending: false })
        .limit(1);

      if (error) {
        console.error("Error loading milk stock:", error);
        toast({
          title: "Error",
          description: "Failed to load milk stock",
          variant: "destructive",
        });
        return;
      }

      if (data && data.length > 0) {
        const stockRecord = data[0] as MilkStockRecord;
        setTotalMilkStock(stockRecord.total_stock || 0);
        setAvailableStock(stockRecord.available_stock || 0);
        setSubscriptionDemand(stockRecord.subscription_demand || 0);
      } else {
        // Set default values when no data is found
        setTotalMilkStock(0);
        setAvailableStock(0);
        setSoldStock(0);
        setSubscriptionDemand(0);
      }
    } catch (error) {
      console.error("Error in loadMilkStock:", error);
      toast({
        title: "Error",
        description: "Failed to load milk stock data",
        variant: "destructive",
      });
      // Set default values on error
      setTotalMilkStock(0);
      setAvailableStock(0);
      setSoldStock(0);
      setSubscriptionDemand(0);
    }
  };

  const loadFarmers = async () => {
    console.log("Loading farmers...");
    const { data: farmersData, error } = await supabase
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
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error loading farmers:", error);
      toast({
        title: "Error",
        description: "Failed to load farmers",
        variant: "destructive",
      });
      return;
    }

    if (farmersData) {
      const transformedFarmers: FarmerProfile[] = farmersData.map(f => ({
        id: f.id,
        email: f.email || '',
        status: f.status || 'pending',
        created_at: f.created_at,
        farm_name: f.farmers?.[0]?.farm_name,
        farm_location: f.farmers?.[0]?.farm_location,
        production_capacity: f.farmers?.[0]?.production_capacity,
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
                      : 'Admin Dashboard'}
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
                  onApprove={(id) => handleFarmerStatus(id, 'approved')}
                  onReject={(id) => handleFarmerStatus(id, 'rejected')}
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
