
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
  highlightStatus?: string;
}

export const FarmersList = ({ 
  title, 
  description, 
  farmers, 
  showActions = false,
  onApprove,
  onReject,
  highlightStatus
}: FarmersListProps) => {
  return (
    <Card className={highlightStatus === 'blacklisted' ? "border-red-300 bg-red-50" : ""}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {farmers.length === 0 ? (
          <p className="text-gray-500">{showActions ? "No pending registrations" : highlightStatus === 'blacklisted' ? "No blacklisted farmers" : "No approved farmers"}</p>
        ) : (
          <div className="space-y-4">
            {farmers.map((farmer) => (
              <FarmerCard 
                key={farmer.id}
                farmer={farmer}
                showActions={showActions}
                onApprove={onApprove}
                onReject={onReject}
                highlightStatus={highlightStatus}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
