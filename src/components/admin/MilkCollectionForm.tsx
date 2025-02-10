
import { useState } from "react";
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

export const MilkCollectionForm = () => {
  const [farmerId, setFarmerId] = useState("");
  const [quantity, setQuantity] = useState<number | "">("");
  const [qualityRating, setQualityRating] = useState<number | "">("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      console.log("Checking for farmer ID:", farmerId);
      
      // Try both ways - as string and as number
      const { data: farmerData, error: farmerError } = await supabase
        .from("farmers")
        .select("id, farmer_id")
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

      // Log the data before inserting to debug
      const contributionData = {
        farmer_id: farmerUuid,
        quantity: Number(quantity),
        // Only use specific values that match the database constraints
        // The quality_rating field likely has a check constraint for specific values
        quality_rating: Number(qualityRating)
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

      toast({
        title: "Success!",
        description: "Milk collection recorded successfully.",
      });

      // Reset form
      setFarmerId("");
      setQuantity("");
      setQualityRating("");
      
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

  return (
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
                <SelectItem value="3">C (Average)</SelectItem>
                <SelectItem value="4">D (Below Standard)</SelectItem>
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
  );
};
