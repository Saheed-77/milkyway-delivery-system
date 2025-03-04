
import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Milk } from "lucide-react";

interface MilkPricing {
  id: string;
  milk_type: string;
  price_per_liter: number;
}

export const MilkPricingForm = () => {
  const [milkPricing, setMilkPricing] = useState<MilkPricing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchMilkPricing();
  }, []);

  const fetchMilkPricing = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("milk_pricing")
        .select("*")
        .order("milk_type");

      if (error) throw error;
      setMilkPricing(data || []);
    } catch (error) {
      console.error("Error fetching milk pricing:", error);
      toast({
        title: "Error",
        description: "Failed to load milk pricing information",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updatePrice = (index: number, newPrice: string) => {
    const updatedPricing = [...milkPricing];
    updatedPricing[index] = {
      ...updatedPricing[index],
      price_per_liter: parseFloat(newPrice) || 0,
    };
    setMilkPricing(updatedPricing);
  };

  const savePricing = async () => {
    try {
      setIsSaving(true);
      
      for (const pricing of milkPricing) {
        const { error } = await supabase
          .from("milk_pricing")
          .update({ price_per_liter: pricing.price_per_liter })
          .eq("id", pricing.id);
        
        if (error) throw error;
      }
      
      toast({
        title: "Success",
        description: "Milk pricing updated successfully",
      });
    } catch (error) {
      console.error("Error updating milk pricing:", error);
      toast({
        title: "Error",
        description: "Failed to update milk pricing",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const formatMilkType = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1) + " Milk";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Milk className="h-5 w-5 text-[#437358]" />
          Milk Pricing Management
        </CardTitle>
        <CardDescription>Set prices for different types of milk</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-center py-4">Loading pricing information...</p>
        ) : (
          <div className="space-y-4">
            {milkPricing.map((pricing, index) => (
              <div key={pricing.id} className="grid grid-cols-2 gap-4 items-center">
                <Label htmlFor={`price-${pricing.id}`}>{formatMilkType(pricing.milk_type)}</Label>
                <div className="flex items-center">
                  <span className="mr-2">₹</span>
                  <Input
                    id={`price-${pricing.id}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={pricing.price_per_liter}
                    onChange={(e) => updatePrice(index, e.target.value)}
                  />
                  <span className="ml-2">per liter</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button
          onClick={savePricing}
          disabled={isLoading || isSaving}
          className="ml-auto"
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </CardFooter>
    </Card>
  );
};
