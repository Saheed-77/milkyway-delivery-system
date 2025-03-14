
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
import { CustomerOrders } from "./CustomerOrders";
import { MilkPricingForm } from "./MilkPricingForm";
import { DeliverySummary } from "../delivery/DeliverySummary";
import { Reports } from "./Reports";
import { FarmerPaymentApproval } from "./FarmerPaymentApproval";
import { Milk, ChartBar, ShoppingBag, UserCheck, UserPlus, BarChart3, CreditCard } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
                <CardTitle>New Orders</CardTitle>
                <CardDescription>Total new orders placed today</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">25</div>
                <div className="flex items-center text-sm text-muted-foreground mt-2">
                  <ShoppingBag className="w-4 h-4 mr-2" />
                  <span>Compared to yesterday</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Website Visits</CardTitle>
                <CardDescription>Number of visits to the website</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">1,250</div>
                <div className="flex items-center text-sm text-muted-foreground mt-2">
                  <ChartBar className="w-4 h-4 mr-2" />
                  <span>Increased by 15%</span>
                </div>
              </CardContent>
            </Card>
          </div>
          
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
                farmers={approvedFarmers}
                showActions={false}
              />
            </div>
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
          <MilkCollectionForm />
          <MilkPricingForm />
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
