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

// Define the milk_stock table interface to match DB schema
interface MilkStockRecord {
  date: string;
  total_stock: number;
  available_stock: number;
  subscription_demand: number;
  leftover_milk: number;
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
          .order("contribution_date", { ascending: false });
          

        if (submissionsError) {
          console.error("Error checking recent submissions:", submissionsError);
          throw new Error("Failed to check farmer submission history");
        }
        
        // Count how many substandard submissions (including current one)
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
          variant: "default",
        });
        
        // Don't add substandard milk to inventory, but record the attempt
        const { error: contributionError } = await supabase
          .from("milk_contributions")
          .insert({
            farmer_id: farmerUuid,
            quantity: 0, // Setting quantity to 0 it won't add to inventory
            quality_rating: Number(qualityRating),
            milk_type: milkType
          });

        if (contributionError) {
          console.error("Contribution error:", contributionError);
          throw contributionError;
        }
        
        toast({
          title: "Submission Recorded",
          description: "Substandard milk was not added to inventory, but the submission was recorded.",
          variant: "default",
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
      // Get milk price for the selected milk type
      const { data: priceData, error: priceError } = await supabase
        .from("milk_pricing")
        .select("price_per_liter")
        .eq("milk_type", milkType)
        .single();

      if (priceError) {
        console.error("Error fetching milk price:", priceError);
        throw new Error("Failed to fetch milk price");
      }
      
      const milkPrice = priceData.price_per_liter;
      const totalAmount = Number(quantity) * milkPrice;
      
      // Create payment entry in the farmer_payments table
      const { data: paymentData, error: paymentError } = await supabase
        .from("farmer_payments")
        .insert({
          farmer_id: farmerUuid,
          amount: totalAmount,
          status: "pending",
          notes: `Payment for ${quantity}L of ${milkType} milk contribution on ${new Date().toLocaleDateString()}`
        })
        .select();
      
      if (paymentError) {
        console.error("Error creating payment record:", paymentError);
        throw new Error("Failed to create payment record");
      }

      // Add milk contribution with payment_id reference
      const contributionData = {
        farmer_id: farmerUuid,
        quantity: Number(quantity),
        quality_rating: Number(qualityRating),
        milk_type: milkType,
        payment_id: paymentData[0].id
      };
      
      console.log("Attempting to insert contribution data:", contributionData);

      // Add milk contribution
      const { error: contributionError } = await supabase
        .from("milk_contributions")
        .insert(contributionData);

      if (contributionError) {
        console.error("Contribution error:", contributionError);
        throw contributionError;
      }

      // Update milk stock directly in the milk_stock table
      const today = new Date().toISOString().split('T')[0]; // Get today's date in YYYY-MM-DD format
      
      try {
        // First try to get current milk_stock for today
        const { data: existingStockData, error: stockFetchError } = await supabase
          .from('milk_stock')
          .select('id, total_stock, available_stock') // Only select needed fields
          .eq('date', today)
          .maybeSingle();
          
        if (stockFetchError) {
          console.error("Error fetching milk stock:", stockFetchError);
          throw new Error("Failed to fetch current milk stock");
        }
        
        if (existingStockData) {
          // Update existing stock record
          const stock = existingStockData as unknown as MilkStockRecord;
          const newTotal = (stock.total_stock || 0) + Number(quantity);
          const newAvailable = (stock.available_stock || 0) + Number(quantity);
          
          const { error: updateError } = await supabase
            .from('milk_stock')
            .update({
              total_stock: newTotal,
              available_stock: newAvailable
            })
            .eq('date', today);
            
          if (updateError) {
            console.error("Error updating milk stock:", updateError);
            throw new Error("Failed to update milk stock");
          }
          
          console.log(`Updated milk stock for ${today}: total=${newTotal}L, available=${newAvailable}L`);
        } else {
          // Create new stock record for today
          const newStockData = {
            date: today,
            total_stock: Number(quantity),
            available_stock: Number(quantity),
            subscription_demand: 0,
            leftover_milk: 0
          };
          
          const { error: insertError } = await supabase
            .from('milk_stock')
            .insert(newStockData as any);
            
          if (insertError) {
            console.error("Error creating milk stock:", insertError);
            throw new Error("Failed to create milk stock record");
          }
          
          console.log(`Created new milk stock for ${today} with ${quantity}L`);
        }

        // Update the corresponding product's stock quantity
        const { data: productData, error: productError } = await supabase
          .from('products')
          .select('id, stock_quantity')
          .eq('milk_type', milkType)
          .single();

        if (productError) {
          console.error("Error fetching product:", productError);
          throw new Error("Failed to fetch product information");
        }

        if (productData) {
          const newStockQuantity = (productData.stock_quantity || 0) + Number(quantity);
          
          const { error: updateProductError } = await supabase
            .from('products')
            .update({ stock_quantity: newStockQuantity })
            .eq('id', productData.id);

          if (updateProductError) {
            console.error("Error updating product stock:", updateProductError);
            throw new Error("Failed to update product stock");
          }

          console.log(`Updated product stock for ${milkType} milk: new quantity=${newStockQuantity}L`);
        }
      
        // Try to update the upsert_milk_stock RPC for compatibility with other components
        try {
          await supabase
            .rpc('upsert_milk_stock', {
              stock_date: today,
              new_total_stock: Number(quantity),
            });
        } catch (rpcError) {
          // Just log this error, don't throw, as we've already updated the table directly
          console.log("RPC call failed, but direct table update succeeded", rpcError);
        }
        
        toast({
          title: "Success!",
          description: "Milk collection and payment record created successfully.",
        });
        
      } catch (stockError) {
        // Just show a warning but don't prevent submission
        console.error("Error updating milk stock:", stockError);
        toast({
          title: "Success with Warning",
          description: "Milk collection recorded, but stock update may be incomplete. Refresh the page to see latest data.",
          variant: "default",
        });
      }

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
