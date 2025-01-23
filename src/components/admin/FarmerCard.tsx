
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";

interface FarmerProfile {
  id: string;
  email: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  farm_name?: string;
  farm_location?: string;
  production_capacity?: number;
}

interface FarmerCardProps {
  farmer: FarmerProfile;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  showActions?: boolean;
}

export const FarmerCard = ({ farmer, onApprove, onReject, showActions = false }: FarmerCardProps) => {
  return (
    <div key={farmer.id} className="border p-4 rounded-lg">
      <p className="font-medium">{farmer.email}</p>
      {farmer.farm_name && (
        <p className="text-sm text-gray-600">Farm: {farmer.farm_name}</p>
      )}
      {farmer.farm_location && (
        <p className="text-sm text-gray-600">Location: {farmer.farm_location}</p>
      )}
      {farmer.production_capacity && (
        <p className="text-sm text-gray-600">
          Capacity: {farmer.production_capacity} liters/day
        </p>
      )}
      <p className="text-sm text-gray-500">
        {showActions ? "Registered" : "Approved"}: {new Date(farmer.created_at).toLocaleDateString()}
      </p>
      {showActions && onApprove && onReject && (
        <div className="mt-2 flex gap-2">
          <Button
            size="sm"
            className="bg-green-500 hover:bg-green-600"
            onClick={() => onApprove(farmer.id)}
          >
            <Check className="w-4 h-4 mr-1" /> Approve
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => onReject(farmer.id)}
          >
            <X className="w-4 h-4 mr-1" /> Reject
          </Button>
        </div>
      )}
    </div>
  );
};
