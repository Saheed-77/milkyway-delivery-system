
import { Button } from "@/components/ui/button";
import { Check, X, AlertTriangle } from "lucide-react";

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
  highlightStatus?: string;
}

export const FarmerCard = ({ farmer, onApprove, onReject, showActions = false, highlightStatus }: FarmerCardProps) => {
  const isBlacklisted = farmer.status === 'rejected' || highlightStatus === 'blacklisted';

  return (
    <div 
      key={farmer.id} 
      className={`border p-4 rounded-lg ${isBlacklisted ? "border-red-300 bg-red-50" : ""}`}
    >
      <div className="flex justify-between items-start">
        <p className="font-medium">{farmer.email}</p>
        {isBlacklisted && (
          <span className="inline-flex items-center bg-red-100 text-red-800 text-xs font-medium px-2 py-1 rounded-full">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Blacklisted
          </span>
        )}
      </div>
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
        {isBlacklisted ? "Blacklisted" : showActions ? "Registered" : "Approved"}: {new Date(farmer.created_at).toLocaleDateString()}
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
