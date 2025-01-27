
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FarmersList } from "./FarmersList";
import { Milk, ChartBar, ShoppingBag } from "lucide-react";

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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="lg:col-span-2">
            <Card className="bg-white shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-2xl font-bold">Daily Overview</CardTitle>
                <ChartBar className="w-8 h-8 text-[#437358]" />
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">Today's performance metrics</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between py-2">
                      <CardTitle className="text-lg font-medium">Milk Stock</CardTitle>
                      <Milk className="w-5 h-5 text-[#437358]" />
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-bold">{totalMilkStock} liters</p>
                      <p className="text-xs text-muted-foreground">Current available stock</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between py-2">
                      <CardTitle className="text-lg font-medium">Daily Sales</CardTitle>
                      <ShoppingBag className="w-5 h-5 text-[#437358]" />
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-bold">0</p>
                      <p className="text-xs text-muted-foreground">No sales data available yet</p>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest updates from farmers and customers</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-500">No recent activity to display</p>
              </CardContent>
            </Card>
          </div>
        </div>
      );
    case "farmers":
      return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="lg:col-span-2">
            <Card className="bg-white shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-2xl font-bold">Milk Stock Overview</CardTitle>
                <Milk className="w-8 h-8 text-[#437358]" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Milk Stock</p>
                    <h2 className="text-3xl font-bold">{totalMilkStock} liters</h2>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <FarmersList
            title="Pending Farmer Registrations"
            description="Review and approve new farmer applications"
            farmers={pendingFarmers}
            showActions={true}
            onApprove={onApprove}
            onReject={onReject}
          />
          <FarmersList
            title="Approved Farmers"
            description="View all approved farmer profiles"
            farmers={approvedFarmers}
          />
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
