
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Milk } from "lucide-react";

interface MilkStock {
  id?: number;
  total_stock: number | null;
}

export const MilkCollection = () => {
  const [quantity, setQuantity] = useState("");
  const [milkType, setMilkType] = useState("cow");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!quantity || parseFloat(quantity) <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid quantity",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Get the current session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("You must be logged in to add milk collection");
      }

      // Create a milk contribution record
      const { error: contributionError } = await supabase
        .from('milk_contributions')
        .insert({
          farmer_id: session.user.id,
          quantity: parseFloat(quantity),
          milk_type: milkType,
        });

      if (contributionError) throw contributionError;

      // Get milk stock data
      const { data: stockData, error: stockReadError } = await supabase
        .from('milk_stock')
        .select('*');

      if (stockReadError) throw stockReadError;

      // Safely handle the data with proper type checking
      let currentStock = 0;
      let stockId = 1;
      
      if (stockData && stockData.length > 0) {
        // Use proper type assertion and handle potential null values
        const stockRecord = stockData[0];
        currentStock = stockRecord.total_stock ?? 0;
        stockId = 1; // Default to ID 1 if not available
      }

      // Update the milk stock with the new total
      const newTotal = currentStock + parseFloat(quantity);
      const { error: updateError } = await supabase
        .from('milk_stock')
        .update({ total_stock: newTotal })
        .eq('id', stockId);

      if (updateError) throw updateError;

      // Show success message and reset form
      toast({
        title: "Success",
        description: `Added ${quantity} liters of ${milkType} milk`,
      });
      setQuantity("");
      
    } catch (error) {
      console.error("Error submitting milk collection:", error);
      toast({
        title: "Error",
        description: "Failed to submit milk collection",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Milk className="h-5 w-5 text-[#437358]" />
          Add Milk Collection
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="milkType">Milk Type</Label>
            <Select 
              value={milkType} 
              onValueChange={setMilkType}
            >
              <SelectTrigger id="milkType">
                <SelectValue placeholder="Select milk type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cow">Cow Milk</SelectItem>
                <SelectItem value="buffalo">Buffalo Milk</SelectItem>
                <SelectItem value="goat">Goat Milk</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity (Liters)</Label>
            <Input
              id="quantity"
              type="number"
              step="0.1"
              min="0.1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </div>
          
          <CardFooter className="px-0 pt-2">
            <Button 
              type="submit" 
              className="w-full bg-[#437358] hover:bg-[#345c46]"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Submitting..." : "Add Collection"}
            </Button>
          </CardFooter>
        </form>
      </CardContent>
    </Card>
  );
};
