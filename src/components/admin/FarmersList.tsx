
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FarmerCard } from "./FarmerCard";

interface FarmerProfile {
  id: string;
  email: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  farm_name?: string;
  farm_location?: string;
  production_capacity?: number;
}

interface FarmersListProps {
  title: string;
  description: string;
  farmers: FarmerProfile[];
  showActions?: boolean;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}

export const FarmersList = ({ 
  title, 
  description, 
  farmers, 
  showActions = false,
  onApprove,
  onReject 
}: FarmersListProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {farmers.length === 0 ? (
          <p className="text-gray-500">{showActions ? "No pending registrations" : "No approved farmers"}</p>
        ) : (
          <div className="space-y-4">
            {farmers.map((farmer) => (
              <FarmerCard 
                key={farmer.id}
                farmer={farmer}
                showActions={showActions}
                onApprove={onApprove}
                onReject={onReject}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
