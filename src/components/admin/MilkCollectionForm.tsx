
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
      // Verify farmer exists
      const { data: farmer, error: farmerError } = await supabase
        .from("farmers")
        .select("id")
        .eq("farmer_id", farmerId)
        .single();

      if (farmerError || !farmer) {
        throw new Error("Invalid Farmer ID");
      }

      // Add milk contribution
      const { error: contributionError } = await supabase
        .from("milk_contributions")
        .insert({
          farmer_id: farmer.id,
          quantity: Number(quantity),
          quality_rating: qualityRating === "" ? null : Number(qualityRating)
        });

      if (contributionError) throw contributionError;

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
              placeholder="Enter 5-digit Farmer ID"
              required
            />
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
                <SelectItem value="90">A (Excellent)</SelectItem>
                <SelectItem value="80">B (Good)</SelectItem>
                <SelectItem value="70">C (Average)</SelectItem>
                <SelectItem value="50">D (Below Standard)</SelectItem>
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
