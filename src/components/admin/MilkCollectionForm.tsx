
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";

interface FarmerOffense {
  count: number;
  lastDate: string;
}

export const MilkCollectionForm = () => {
  const [farmerId, setFarmerId] = useState("");
  const [quantity, setQuantity] = useState<number | "">("");
  const [qualityRating, setQualityRating] = useState<number | "">("");
  const [milkType, setMilkType] = useState("cow");
  const [isLoading, setIsLoading] = useState(false);
  const [showBlacklistDialog, setShowBlacklistDialog] = useState(false);
  const [farmerDetails, setFarmerDetails] = useState<any>(null);
  const [offenseCount, setOffenseCount] = useState(0);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      console.log("Checking for farmer ID:", farmerId);
      
      // Try both ways - as string and as number
      const { data: farmerData, error: farmerError } = await supabase
        .from("farmers")
        .select("id, farmer_id, profiles(id, email, first_name, last_name)")
        .or(`farmer_id.eq.${farmerId},farmer_id.eq.${Number(farmerId)}`)
        .maybeSingle();
        
      console.log("Farmer search result:", farmerData, farmerError);
        
      if (farmerError) {
        console.error("Database error:", farmerError);
        throw new Error("Failed to check farmer ID");
      }
      
      if (!farmerData) {
        // Get all farmers for debugging
        const { data: allFarmers } = await supabase
          .from("farmers")
          .select("id, farmer_id");
        
        console.log("All farmers in the database:", allFarmers);
        throw new Error("Invalid Farmer ID: No farmer found with this ID");
      }
      
      const farmerUuid = farmerData.id;
      
      // Check if milk quality is substandard (level 3)
      if (Number(qualityRating) === 3) {
        console.log("Substandard milk detected. Checking farmer history...");
        
        // Get recent submissions from this farmer
        const { data: recentSubmissions, error: submissionsError } = await supabase
          .from("milk_contributions")
          .select("contribution_date, quality_rating")
          .eq("farmer_id", farmerUuid)
          .order("contribution_date", { ascending: false })
          .limit(3);
          
        if (submissionsError) {
          console.error("Error checking recent submissions:", submissionsError);
          throw new Error("Failed to check farmer submission history");
        }
        
        // Count how many consecutive substandard submissions (including current one)
        let consecutiveOffenses = 1; // Start with 1 for current submission
        if (recentSubmissions && recentSubmissions.length > 0) {
          for (const submission of recentSubmissions) {
            if (submission.quality_rating === 3) {
              consecutiveOffenses++;
            } else {
              break; // Stop counting if we find a non-substandard submission
            }
          }
        }
        
        console.log(`Farmer has ${consecutiveOffenses} consecutive substandard submissions`);
        setOffenseCount(consecutiveOffenses);
        
        if (consecutiveOffenses >= 3) {
          // Get full farmer details for the blacklist dialog
          setFarmerDetails({
            ...farmerData,
            offenseCount: consecutiveOffenses
          });
          
          // Show blacklist dialog
          setShowBlacklistDialog(true);
          
          // Update farmer status to blacklisted
          const { error: blacklistError } = await supabase
            .from("profiles")
            .update({ status: "rejected" })
            .eq("id", farmerUuid);
            
          if (blacklistError) {
            console.error("Error blacklisting farmer:", blacklistError);
          } else {
            console.log("Farmer has been blacklisted");
          }
          
          toast({
            title: "Farmer Blacklisted",
            description: "This farmer has been blacklisted due to repeated substandard milk submissions.",
            variant: "destructive",
          });
          
          setIsLoading(false);
          return; // Stop here, don't record this milk contribution
        }
        
        // For first and second offenses, just notify
        toast({
          title: "Substandard Milk Detected",
          description: `Offense ${consecutiveOffenses} of 3. Farmer will be blacklisted after 3 consecutive substandard submissions.`,
          variant: "warning",
        });
        
        // Don't add substandard milk to inventory, but record the attempt
        const { error: contributionError } = await supabase
          .from("milk_contributions")
          .insert({
            farmer_id: farmerUuid,
            quantity: Number(quantity),
            quality_rating: Number(qualityRating),
            milk_type: milkType,
            // Setting quantity to 0 effectively means it won't add to inventory
            quantity: 0
          });

        if (contributionError) {
          console.error("Contribution error:", contributionError);
          throw contributionError;
        }
        
        toast({
          title: "Submission Recorded",
          description: "Substandard milk was not added to inventory, but the submission was recorded.",
          variant: "warning",
        });
        
        // Reset form
        setFarmerId("");
        setQuantity("");
        setQualityRating("");
        setMilkType("cow");
        
        setIsLoading(false);
        return;
      }

      // For acceptable quality milk, proceed normally
      const contributionData = {
        farmer_id: farmerUuid,
        quantity: Number(quantity),
        quality_rating: Number(qualityRating),
        milk_type: milkType
      };
      
      console.log("Attempting to insert contribution data:", contributionData);

      // Add milk contribution - price will be calculated by the trigger
      const { error: contributionError } = await supabase
        .from("milk_contributions")
        .insert(contributionData);

      if (contributionError) {
        console.error("Contribution error:", contributionError);
        throw contributionError;
      }

      toast({
        title: "Success!",
        description: "Milk collection recorded successfully.",
      });

      // Reset form
      setFarmerId("");
      setQuantity("");
      setQualityRating("");
      setMilkType("cow");
      
    } catch (error) {
      console.error("Error recording milk collection:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to record milk collection",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const closeBlacklistDialog = () => {
    setShowBlacklistDialog(false);
    setFarmerDetails(null);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Record Milk Collection</CardTitle>
          <CardDescription>Enter the collection details</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="farmerId" className="block text-sm font-medium text-gray-700 mb-1">
                Farmer ID
              </label>
              <Input
                id="farmerId"
                type="text"
                value={farmerId}
                onChange={(e) => setFarmerId(e.target.value)}
                placeholder="Enter Farmer ID"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter the 5-digit Farmer ID (not UUID)
              </p>
            </div>
            
            <div>
              <label htmlFor="milkType" className="block text-sm font-medium text-gray-700 mb-1">
                Milk Type
              </label>
              <Select 
                value={milkType} 
                onValueChange={setMilkType}
              >
                <SelectTrigger id="milkType">
                  <SelectValue placeholder="Select milk type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cow">Cow</SelectItem>
                  <SelectItem value="buffalo">Buffalo</SelectItem>
                  <SelectItem value="goat">Goat</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1">
                Quantity (liters)
              </label>
              <Input
                id="quantity"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="Enter quantity in liters"
                min="0"
                step="0.1"
                required
              />
            </div>
            <div>
              <label htmlFor="qualityRating" className="block text-sm font-medium text-gray-700 mb-1">
                Quality Rating
              </label>
              <Select onValueChange={(value) => setQualityRating(Number(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select quality rating" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">A (Excellent)</SelectItem>
                  <SelectItem value="2">B (Good)</SelectItem>
                  <SelectItem value="3">C (Below Standard)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              type="submit"
              className="w-full bg-[#437358] hover:bg-[#345c46]"
              disabled={isLoading}
            >
              {isLoading ? "Recording..." : "Record Collection"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Dialog open={showBlacklistDialog} onOpenChange={setShowBlacklistDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center text-red-600">
              <AlertTriangle className="mr-2 h-5 w-5" />
              Farmer Blacklisted
            </DialogTitle>
            <DialogDescription>
              This farmer has been automatically blacklisted due to 3 consecutive substandard milk submissions.
            </DialogDescription>
          </DialogHeader>
          
          {farmerDetails && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Farmer ID:</p>
                  <p className="text-sm">{farmerDetails.farmer_id}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Name:</p>
                  <p className="text-sm">
                    {farmerDetails.profiles?.first_name || 'Unknown'} {farmerDetails.profiles?.last_name || ''}
                  </p>
                </div>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-500">Email:</p>
                <p className="text-sm">{farmerDetails.profiles?.email || 'No email available'}</p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-red-600">Consecutive offenses:</p>
                <p className="text-sm font-bold">{farmerDetails.offenseCount} substandard submissions</p>
              </div>
              
              <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                <p className="text-sm text-amber-800">
                  This farmer's account has been automatically rejected and they will no longer be able to submit milk.
                  You may need to contact them directly to discuss this issue.
                </p>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={closeBlacklistDialog}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
