
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface MilkContributionFormProps {
  farmerId?: string;
}

export const MilkContributionForm = ({ farmerId }: MilkContributionFormProps) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quantity, setQuantity] = useState(0);
  const [milkType, setMilkType] = useState("cow");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!farmerId) {
      toast({
        title: "Error",
        description: "Farmer ID is missing. Please try again.",
        variant: "destructive",
      });
      return;
    }

    if (quantity <= 0) {
      toast({
        title: "Invalid quantity",
        description: "Please enter a valid quantity greater than 0.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Get milk price for the selected milk type
      const { data: priceData, error: priceError } = await supabase
        .from("milk_pricing")
        .select("price_per_liter")
        .eq("milk_type", milkType)
        .single();

      if (priceError) throw priceError;
      
      const milkPrice = priceData.price_per_liter;
      const totalAmount = quantity * milkPrice;
      
      // Create payment entry in the farmer_payments table
      const { data: paymentData, error: paymentError } = await supabase
        .from("farmer_payments")
        .insert({
          farmer_id: farmerId,
          amount: totalAmount,
          status: "pending",
          notes: `Payment for ${quantity}L of ${milkType} milk contribution on ${new Date().toLocaleDateString()}`
        })
        .select();
      
      if (paymentError) {
        console.error("Error creating payment record:", paymentError);
        throw new Error("Failed to create payment record");
      }

      // Add the milk contribution with payment_id reference
      const { data: contributionData, error: contributionError } = await supabase
        .from("milk_contributions")
        .insert({
          farmer_id: farmerId,
          quantity,
          milk_type: milkType,
          contribution_date: new Date().toISOString(),
          payment_id: paymentData[0].id
        })
        .select();

      if (contributionError) throw contributionError;

      // Update milk stock - fix TypeScript error by explicitly using Number
      const { error: stockError } = await supabase
        .rpc("update_milk_stock_safe", { 
          add_quantity: Number(quantity) 
        });

      if (stockError) {
        console.error("Error updating milk stock:", stockError);
      }

      toast({
        title: "Contribution recorded",
        description: `Successfully added ${quantity} liters of ${milkType} milk and created a pending payment.`,
      });

      // Reset form
      setQuantity(0);
    } catch (error: any) {
      toast({
        title: "Error recording contribution",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="milk-type">Milk Type</Label>
        <Select 
          value={milkType} 
          onValueChange={setMilkType}
          disabled={isSubmitting}
        >
          <SelectTrigger id="milk-type">
            <SelectValue placeholder="Select milk type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cow">Cow Milk</SelectItem>
            <SelectItem value="goat">Goat Milk</SelectItem>
            <SelectItem value="buffalo">Buffalo Milk</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="quantity">Quantity (Liters)</Label>
        <Input
          id="quantity"
          type="number"
          min="0"
          step="0.1"
          value={quantity || ""}
          onChange={(e) => setQuantity(Number(e.target.value))}
          disabled={isSubmitting}
        />
      </div>

      <Button 
        type="submit" 
        className="w-full bg-[#437358] hover:bg-[#386349]"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Recording..." : "Record Contribution"}
      </Button>
    </form>
  );
};
