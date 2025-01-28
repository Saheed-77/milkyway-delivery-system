import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FarmersList } from "./FarmersList";
import { FarmerRegistrationForm } from "./FarmerRegistrationForm";
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
      );
    case "farmers":
      return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Farmers Registration Form */}
          <div className="lg:col-span-1">
            <FarmerRegistrationForm />
          </div>
          
          {/* Pending Farmers */}
          <div className="lg:col-span-1">
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
          <div className="lg:col-span-2">
            <FarmersList
              title="Approved Farmers"
              description="Active farmers in the system"
              farmers={approvedFarmers}
              showActions={false}
            />
          </div>
        </div>
      );
    case "collections":
      return (
        <Card>
          <CardHeader>
            <CardTitle>Milk Collections</CardTitle>
            <CardDescription>Track daily milk contributions from farmers</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500">Coming soon...</p>
          </CardContent>
        </Card>
      );
    case "orders":
      return (
        <Card>
          <CardHeader>
            <CardTitle>Customer Orders</CardTitle>
            <CardDescription>Manage orders from customers</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500">Coming soon...</p>
          </CardContent>
        </Card>
      );
    case "delivery":
      return (
        <Card>
          <CardHeader>
            <CardTitle>Delivery Management</CardTitle>
            <CardDescription>Schedule and track deliveries</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500">Coming soon...</p>
          </CardContent>
        </Card>
      );
    default:
      return null;
  }
};
