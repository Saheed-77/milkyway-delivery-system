
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PaymentOverview } from "@/components/farmer/PaymentOverview";
import { ContributionHistory } from "@/components/farmer/ContributionHistory";
import { FarmerSidebar } from "@/components/farmer/FarmerSidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FarmerWallet } from "@/components/farmer/FarmerWallet";
import { WeeklyReports } from "@/components/farmer/WeeklyReports";

const FarmerDashboard = () => {
  const navigate = useNavigate();
  const [farmerProfile, setFarmerProfile] = useState<any>(null);

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

  return (
    <SidebarProvider>
      <FarmerSidebar />
      <SidebarInset>
        <div className="min-h-screen bg-[#f8f7f3] p-4 md:p-8">
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
          
          <Tabs defaultValue="overview" className="w-full">
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
    </SidebarProvider>
  );
};

export default FarmerDashboard;
