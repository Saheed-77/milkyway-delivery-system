
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MilkContributionForm } from "@/components/farmer/MilkContributionForm";
import { ContributionHistory } from "@/components/farmer/ContributionHistory";
import { PaymentOverview } from "@/components/farmer/PaymentOverview";
import { FarmerSidebar } from "@/components/farmer/FarmerSidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";

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
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            <Card className="md:col-span-1">
              <CardHeader>
                <CardTitle>Today's Contribution</CardTitle>
                <CardDescription>Record your milk contribution for today</CardDescription>
              </CardHeader>
              <CardContent>
                <MilkContributionForm farmerId={farmerProfile?.id} />
              </CardContent>
            </Card>
            
            <Card className="md:col-span-1">
              <CardHeader>
                <CardTitle>Payment Overview</CardTitle>
                <CardDescription>Track your earnings from milk contributions</CardDescription>
              </CardHeader>
              <CardContent>
                <PaymentOverview farmerId={farmerProfile?.id} />
              </CardContent>
            </Card>
            
            <Card className="md:col-span-1 lg:col-span-3">
              <CardHeader>
                <CardTitle>Contribution History</CardTitle>
                <CardDescription>View your past milk contributions</CardDescription>
              </CardHeader>
              <CardContent>
                <ContributionHistory farmerId={farmerProfile?.id} />
              </CardContent>
            </Card>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default FarmerDashboard;
