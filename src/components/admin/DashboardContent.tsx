
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FarmersList } from "./FarmersList";
import { FarmerRegistrationForm } from "./FarmerRegistrationForm";
import { MilkCollectionForm } from "./MilkCollectionForm";
import { MilkCollectionsList } from "@/components/shared/MilkCollectionsList";
import { CustomerOrders } from "./CustomerOrders";
import { MilkPricingForm } from "./MilkPricingForm";
import { DeliverySummary } from "../delivery/DeliverySummary";
import { Reports } from "./Reports";
import { FarmerPaymentApproval } from "./FarmerPaymentApproval";
import { Milk, ShoppingBag, UserCheck, UserPlus, BarChart3, CreditCard, List, PlusCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MilkStockManager } from "./MilkStockManager";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface FarmerProfile {
  id: string;
  email: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  farm_name?: string;
  farm_location?: string;
  production_capacity?: number;
}

interface DashboardContentProps {
  activeSection: string;
  pendingFarmers: FarmerProfile[];
  approvedFarmers: FarmerProfile[];
  totalMilkStock: number;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

export const DashboardContent = ({
  activeSection,
  pendingFarmers,
  approvedFarmers,
  totalMilkStock,
  onApprove,
  onReject,
}: DashboardContentProps) => {
  const blacklistedFarmers = approvedFarmers.filter(farmer => farmer.status === 'rejected');
  const activeFarmers = approvedFarmers.filter(farmer => farmer.status === 'approved');
  const [weeklyCollection, setWeeklyCollection] = useState(0);
  const [weeklyOrders, setWeeklyOrders] = useState(0);

  useEffect(() => {
    if (activeSection === "dashboard") {
      // Fetch weekly milk collection volume
      const fetchWeeklyCollection = async () => {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        const { data, error } = await supabase
          .from("milk_contributions")
          .select("quantity")
          .gte("contribution_date", oneWeekAgo.toISOString().split('T')[0]);
          
        if (!error && data) {
          const totalCollection = data.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
          setWeeklyCollection(totalCollection);
        }
      };
      
      // Fetch weekly order volume
      const fetchWeeklyOrders = async () => {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        const { data, error } = await supabase
          .from("order_items")
          .select("order_items.quantity, products.milk_type")
          .join("products", { "order_items.product_id": "products.id" })
          .gte("order_items.created_at", oneWeekAgo.toISOString());
          
        if (!error && data) {
          const totalOrdered = data.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
          setWeeklyOrders(totalOrdered);
        }
      };
      
      fetchWeeklyCollection();
      fetchWeeklyOrders();
      
      // Call the auto-reserve function daily
      const autoReserveStock = async () => {
        try {
          await supabase.rpc('auto_reserve_subscription_stock');
        } catch (error) {
          console.error("Error auto-reserving stock:", error);
        }
      };
      
      // Schedule auto-reservation once at component mount
      autoReserveStock();
    }
  }, [activeSection]);

  switch (activeSection) {
    case "dashboard":
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Total Milk Stock</CardTitle>
                <CardDescription>Current milk stock in liters</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{totalMilkStock} L</div>
                <div className="flex items-center text-sm text-muted-foreground mt-2">
                  <Milk className="w-4 h-4 mr-2" />
                  <span>Updated daily</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Weekly Orders</CardTitle>
                <CardDescription>Milk ordered in the last 7 days</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{weeklyOrders} L</div>
                <div className="flex items-center text-sm text-muted-foreground mt-2">
                  <ShoppingBag className="w-4 h-4 mr-2" />
                  <span>Last 7 days</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Weekly Collection</CardTitle>
                <CardDescription>Milk collected in the last 7 days</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{weeklyCollection} L</div>
                <div className="flex items-center text-sm text-muted-foreground mt-2">
                  <Milk className="w-4 h-4 mr-2" />
                  <span>From all farmers</span>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <MilkStockManager />
          <DeliverySummary />
        </div>
      );
    case "farmers":
      return (
        <Tabs defaultValue="approval" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="approval" className="flex items-center gap-2">
              <UserCheck className="w-4 h-4" />
              Approval Section
            </TabsTrigger>
            <TabsTrigger value="registration" className="flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              New Registrations
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Farmer Payments
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="approval" className="space-y-6">
            {/* Pending Farmers */}
            <div>
              <FarmersList
                title="Pending Registrations"
                description="Farmers awaiting approval"
                farmers={pendingFarmers}
                showActions={true}
                onApprove={onApprove}
                onReject={onReject}
              />
            </div>
            
            {/* Approved Farmers */}
            <div>
              <FarmersList
                title="Approved Farmers"
                description="Active farmers in the system"
                farmers={activeFarmers}
                showActions={false}
              />
            </div>

            {/* Blacklisted Farmers */}
            {blacklistedFarmers.length > 0 && (
              <div>
                <FarmersList
                  title="Blacklisted Farmers"
                  description="Farmers who have been blacklisted"
                  farmers={blacklistedFarmers}
                  showActions={false}
                  highlightStatus="blacklisted"
                />
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="registration">
            {/* Farmers Registration Form */}
            <div>
              <FarmerRegistrationForm />
            </div>
          </TabsContent>
          
          <TabsContent value="payments">
            {/* Farmer Payment Approval */}
            <div>
              <FarmerPaymentApproval />
            </div>
          </TabsContent>
        </Tabs>
      );
    case "collections":
      return (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Total Milk Stock</CardTitle>
              <CardDescription>Current milk stock in liters</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalMilkStock} L</div>
            </CardContent>
          </Card>
          
          <MilkStockManager />
          
          <Tabs defaultValue="collect">
            <TabsList className="mb-6">
              <TabsTrigger value="collect" className="flex items-center gap-2">
                <PlusCircle className="w-4 h-4" />
                Collect Milk
              </TabsTrigger>
              <TabsTrigger value="list" className="flex items-center gap-2">
                <List className="w-4 h-4" />
                Collections List
              </TabsTrigger>
              <TabsTrigger value="pricing" className="flex items-center gap-2">
                <Milk className="w-4 h-4" />
                Milk Pricing
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="collect">
              <MilkCollectionForm />
            </TabsContent>
            
            <TabsContent value="list">
              <MilkCollectionsList />
            </TabsContent>
            
            <TabsContent value="pricing">
              <MilkPricingForm />
            </TabsContent>
          </Tabs>
        </div>
      );
    case "orders":
      return <CustomerOrders />;
    case "delivery":
      return (
        <div className="space-y-6">
          <DeliverySummary />
        </div>
      );
    case "reports":
      return <Reports />;
    default:
      return null;
  }
};
