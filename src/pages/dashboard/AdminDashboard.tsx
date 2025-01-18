
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Check, X } from "lucide-react";

interface FarmerProfile {
  id: string;
  email: string;
  status: string;
  created_at: string;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [pendingFarmers, setPendingFarmers] = useState<FarmerProfile[]>([]);
  const [approvedFarmers, setApprovedFarmers] = useState<FarmerProfile[]>([]);

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
    const { data: farmers, error } = await supabase
      .from("profiles")
      .select("id, email, status, created_at")
      .eq("user_type", "farmer");

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load farmers",
        variant: "destructive",
      });
      return;
    }

    setPendingFarmers(farmers.filter(f => f.status === 'pending'));
    setApprovedFarmers(farmers.filter(f => f.status === 'approved'));
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
    <div className="min-h-screen bg-[#f8f7f3] p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-[#437358]">Admin Dashboard</h1>
        <LogoutButton />
      </div>
      
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
    </div>
  );
};

export default AdminDashboard;
