import { Button } from "@/components/ui/button";
import { Check, X, AlertTriangle, MapPin, Tractor, CalendarDays, User, Clock, Milk, Hash, Home } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface FarmerProfile {
  id: string;
  email: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  farm_name?: string;
  farm_location?: string;
  production_capacity?: number;
  first_name?: string;
  last_name?: string;
  phone?: string;
  address?: string;
  farmer_id?: string;
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
  
  // Generate initials for avatar fallback
  const getInitials = () => {
    if (farmer.first_name && farmer.last_name) {
      return `${farmer.first_name.charAt(0)}${farmer.last_name.charAt(0)}`;
    } else if (farmer.first_name) {
      return farmer.first_name.charAt(0);
    } else if (farmer.email) {
      return farmer.email.charAt(0).toUpperCase();
    }
    return "F";
  };

  // Format date
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "MMM d, yyyy");
    } catch (error) {
      return "Invalid date";
    }
  };

  return (
    <div 
      key={farmer.id} 
      className={`border p-5 rounded-lg ${isBlacklisted ? "border-red-300 bg-red-50" : "hover:border-green-200 hover:shadow-sm transition-all"}`}
    >
      <div className="flex items-start gap-4">
        <Avatar className={`h-14 w-14 ${isBlacklisted ? "border-2 border-red-200" : ""}`}>
          <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${farmer.first_name || farmer.email}`} alt={farmer.farm_name || "Farmer"} />
          <AvatarFallback className="bg-green-100 text-green-800 font-medium">
            {getInitials()}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg">
                  {farmer.first_name && farmer.last_name 
                    ? `${farmer.first_name} ${farmer.last_name}`
                    : farmer.email}
                </h3>
                
                {farmer.farmer_id && (
                  <Badge variant="outline" className="ml-1 flex items-center gap-1 bg-blue-50 text-blue-700 border-blue-200">
                    <Hash className="w-3 h-3" />
                    <span>ID: {farmer.farmer_id}</span>
                  </Badge>
                )}
                
                {isBlacklisted && (
                  <Badge variant="destructive" className="ml-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    <span>Blacklisted</span>
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{farmer.email}</p>
            </div>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge 
                    className={`${
                      farmer.status === "approved" 
                        ? "bg-green-100 text-green-800 hover:bg-green-200" 
                        : farmer.status === "rejected" 
                          ? "bg-red-100 text-red-800 hover:bg-red-200" 
                          : "bg-amber-100 text-amber-800 hover:bg-amber-200"
                    }`}
                  >
                    {farmer.status.charAt(0).toUpperCase() + farmer.status.slice(1)}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{farmer.status === "pending" ? "Awaiting approval" : farmer.status === "rejected" ? "Rejected/Blacklisted" : "Approved farmer"}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 mt-3">
            {farmer.farm_name && (
              <div className="flex items-center text-sm gap-2">
                <Tractor className="h-4 w-4 text-gray-500" />
                <span className="text-gray-700">{farmer.farm_name}</span>
              </div>
            )}
            
            {farmer.farm_location && (
              <div className="flex items-center text-sm gap-2">
                <MapPin className="h-4 w-4 text-gray-500" />
                <span className="text-gray-700">{farmer.farm_location}</span>
              </div>
            )}
            
            {farmer.address && (
              <div className="flex items-center text-sm gap-2">
                <Home className="h-4 w-4 text-gray-500" />
                <span className="text-gray-700">{farmer.address}</span>
              </div>
            )}
            
            {farmer.production_capacity && (
              <div className="flex items-center text-sm gap-2">
                <Milk className="h-4 w-4 text-gray-500" />
                <span className="text-gray-700">{farmer.production_capacity} liters/day</span>
              </div>
            )}
            
            <div className="flex items-center text-sm gap-2">
              <Clock className="h-4 w-4 text-gray-500" />
              <span className="text-gray-700">Registered: {formatDate(farmer.created_at)}</span>
            </div>
            
            {farmer.phone && (
              <div className="flex items-center text-sm gap-2">
                <User className="h-4 w-4 text-gray-500" />
                <span className="text-gray-700">{farmer.phone}</span>
              </div>
            )}
          </div>
          
          {showActions && onApprove && onReject && (
            <div className="mt-4 flex gap-2">
              <Button
                size="sm"
                className="bg-green-500 hover:bg-green-600 text-white"
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
      </div>
    </div>
  );
};
