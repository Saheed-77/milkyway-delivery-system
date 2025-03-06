
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PaymentOverview } from "@/components/farmer/PaymentOverview";
import { ContributionHistory } from "@/components/farmer/ContributionHistory";
import { SidebarProvider, SidebarInset, Sidebar } from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FarmerWallet } from "@/components/farmer/FarmerWallet";
import { WeeklyReports } from "@/components/farmer/WeeklyReports";
import { Navbar } from "@/components/layout/Navbar";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";

const FarmerDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [farmerProfile, setFarmerProfile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth/farmer");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("user_type, first_name, last_name")
        .eq("id", session.user.id)
        .single();

      if (profile?.user_type !== "farmer") {
        navigate("/");
        return;
      }

      // Get farmer details
      const { data: farmerData } = await supabase
        .from("farmers")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();

      setFarmerProfile({
        ...profile,
        ...farmerData,
        id: session.user.id
      });
    };

    checkAuth();
  }, [navigate]);

  // Get active tab from hash if present
  useEffect(() => {
    const hash = location.hash.replace('#', '');
    if (hash && ['overview', 'wallet', 'history', 'reports'].includes(hash)) {
      setActiveTab(hash);
    }
  }, [location]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    navigate({ hash: value });
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
                userType="farmer" 
                activeSection={activeTab}
                onSectionChange={handleTabChange}
              />
            </Sidebar>
            <SidebarInset>
              <div className="min-h-screen p-4 md:p-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-3">
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-[#437358]">
                      {farmerProfile?.first_name ? `Welcome, ${farmerProfile.first_name}` : 'Farmer Dashboard'}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      Manage your milk contributions and track your payments
                    </p>
                  </div>
                  <LogoutButton />
                </div>
                
                <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                  <TabsList className="mb-6 w-full justify-start">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="wallet">Wallet</TabsTrigger>
                    <TabsTrigger value="history">Contribution History</TabsTrigger>
                    <TabsTrigger value="reports">Weekly Reports</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="overview">
                    <Card>
                      <CardHeader>
                        <CardTitle>Payment Overview</CardTitle>
                        <CardDescription>Track your earnings from milk contributions</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <PaymentOverview farmerId={farmerProfile?.id} />
                      </CardContent>
                    </Card>
                  </TabsContent>
                  
                  <TabsContent value="wallet">
                    <Card>
                      <CardHeader>
                        <CardTitle>Wallet</CardTitle>
                        <CardDescription>Manage your earnings and transactions</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <FarmerWallet farmerId={farmerProfile?.id} />
                      </CardContent>
                    </Card>
                  </TabsContent>
                  
                  <TabsContent value="history">
                    <Card>
                      <CardHeader>
                        <CardTitle>Contribution History</CardTitle>
                        <CardDescription>View your past milk contributions</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ContributionHistory farmerId={farmerProfile?.id} />
                      </CardContent>
                    </Card>
                  </TabsContent>
                  
                  <TabsContent value="reports">
                    <Card>
                      <CardHeader>
                        <CardTitle>Weekly Reports</CardTitle>
                        <CardDescription>View your weekly production and earnings</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <WeeklyReports farmerId={farmerProfile?.id} />
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>
            </SidebarInset>
          </div>
        </SidebarProvider>
      </div>
    </div>
  );
};

export default FarmerDashboard;
