
import { useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Truck, Check } from "lucide-react";

// Define a proper type for milk stock
interface MilkStock {
  total_stock: number | null;
}

export const MilkCollection = () => {
  const [farmerId, setFarmerId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [milkType, setMilkType] = useState("cow");
  const [qualityRating, setQualityRating] = useState("5");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // First verify if the farmer exists and is approved
      const { data: farmer, error: farmerError } = await supabase
        .from('profiles')
        .select('id, status')
        .eq('id', farmerId)
        .eq('user_type', 'farmer')
        .single();

      if (farmerError) {
        throw new Error('Farmer not found. Please check the ID and try again.');
      }

      if (farmer.status !== 'approved') {
        throw new Error('This farmer is not approved yet.');
      }

      // Record the milk contribution
      const { error: contributionError } = await supabase
        .from('milk_contributions')
        .insert({
          farmer_id: farmerId,
          quantity: parseFloat(quantity),
          quality_rating: parseInt(qualityRating),
          milk_type: milkType
        });

      if (contributionError) throw contributionError;

      // Update total milk stock with proper type handling
      const { data: stockData, error: stockReadError } = await supabase
        .from('milk_stock')
        .select('total_stock');

      if (stockReadError) throw stockReadError;

      // Safely handle the data with proper type checking
      let currentStock = 0;
      if (stockData && stockData.length > 0) {
        const stockItem = stockData[0] as MilkStock;
        if (stockItem.total_stock !== null) {
          currentStock = stockItem.total_stock;
        }
      }

      // Calculate the new total stock
      const newTotal = currentStock + parseFloat(quantity);

      // Update the milk_stock table with the new total
      const { error: stockError } = await supabase
        .from('milk_stock')
        .update({ total_stock: newTotal })
        .eq('id', 1);  // Assuming there's only one row in milk_stock

      if (stockError) throw stockError;

      toast({
        title: 'Collection Recorded',
        description: `Successfully recorded ${quantity} liters of milk from farmer.`,
      });

      // Reset form
      setFarmerId("");
      setQuantity("");
      setQualityRating("5");

    } catch (error: any) {
      console.error('Error recording collection:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to record milk collection',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Record Milk Collection</CardTitle>
          <CardDescription>Record milk collections from farmers during delivery routes</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="farmerId">Farmer ID</Label>
              <Input
                id="farmerId"
                value={farmerId}
                onChange={(e) => setFarmerId(e.target.value)}
                placeholder="Enter farmer's UUID"
                required
              />
              <p className="text-xs text-muted-foreground">Enter the unique ID of the farmer</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity (liters)</Label>
              <Input
                id="quantity"
                type="number"
                min="0.1"
                step="0.1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="100"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="milkType">Milk Type</Label>
              <Select value={milkType} onValueChange={setMilkType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select milk type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cow">Cow</SelectItem>
                  <SelectItem value="goat">Goat</SelectItem>
                  <SelectItem value="buffalo">Buffalo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="qualityRating">Quality Rating (1-10)</Label>
              <Select value={qualityRating} onValueChange={setQualityRating}>
                <SelectTrigger>
                  <SelectValue placeholder="Select quality rating" />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(rating => (
                    <SelectItem key={rating} value={rating.toString()}>
                      {rating}
                    </SelectItem>
                  ))}
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5" />
            Collection Guidelines
          </CardTitle>
          <CardDescription>Follow these best practices when collecting milk</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-600 mt-0.5" />
              <span>Ensure milk is fresh and properly stored in clean containers</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-600 mt-0.5" />
              <span>Verify the temperature of milk before collection (4°C or below)</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-600 mt-0.5" />
              <span>Check for any visible contaminants or abnormal appearance</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-600 mt-0.5" />
              <span>Measure quantity accurately using calibrated equipment</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-600 mt-0.5" />
              <span>Transport in refrigerated vehicle to maintain cold chain</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};
