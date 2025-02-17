
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { MilkContributionForm } from "@/components/farmer/MilkContributionForm";
import { ContributionHistory } from "@/components/farmer/ContributionHistory";
import { PaymentOverview } from "@/components/farmer/PaymentOverview";
import { FarmerStatsSummary } from "@/components/farmer/FarmerStatsSummary";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Cow, History, BanknoteIcon, LayoutDashboard } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

const FarmerDashboard = () => {
  const navigate = useNavigate();
  const [farmerName, setFarmerName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        setIsLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate("/auth/farmer");
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("user_type, first_name, last_name")
          .eq("id", session.user.id)
          .single();

        if (profileError) throw profileError;

        if (profile?.user_type !== "farmer") {
          navigate("/");
          return;
        }

        // Set farmer name if available
        if (profile.first_name || profile.last_name) {
          setFarmerName(
            `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
          );
        }
      } catch (error) {
        console.error("Authentication error:", error);
        toast({
          title: "Authentication Error",
          description: "There was an error verifying your account. Please try logging in again.",
          variant: "destructive",
        });
        navigate("/auth/farmer");
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f8f7f3] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#437358]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f7f3] p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#437358]">
              {farmerName ? `Welcome, ${farmerName}` : 'Farmer Dashboard'}
            </h1>
            <p className="text-gray-600">
              Manage your milk contributions and track payments
            </p>
          </div>
          <LogoutButton />
        </div>

        <div className="mb-8">
          <FarmerStatsSummary />
        </div>

        <Tabs defaultValue="contribute" className="space-y-6">
          <TabsList className="grid grid-cols-3 mb-4">
            <TabsTrigger value="contribute" className="flex items-center gap-2">
              <Cow className="h-4 w-4" />
              <span className="hidden sm:inline">Contribute</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">History</span>
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex items-center gap-2">
              <BanknoteIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Payments</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="contribute">
            <MilkContributionForm />
          </TabsContent>

          <TabsContent value="history">
            <ContributionHistory />
          </TabsContent>

          <TabsContent value="payments">
            <PaymentOverview />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default FarmerDashboard;
