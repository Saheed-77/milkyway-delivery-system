
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
      const { error } = await supabase.from("milk_contributions").insert({
        farmer_id: farmerId,
        quantity,
        milk_type: milkType,
        contribution_date: new Date().toISOString(),
      });

      if (error) throw error;

      toast({
        title: "Contribution recorded",
        description: `Successfully added ${quantity} liters of ${milkType} milk.`,
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
