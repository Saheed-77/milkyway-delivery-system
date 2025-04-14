
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
import { Milk, Beaker } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";

export const DeliveryMilkCollectionForm = () => {
  const [farmers, setFarmers] = useState([]);
  const [milkTypes, setMilkTypes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Form state
  const [selectedFarmer, setSelectedFarmer] = useState("");
  const [selectedMilkType, setSelectedMilkType] = useState("cow");
  const [quantity, setQuantity] = useState(0);
  const [qualityRating, setQualityRating] = useState(1);

  useEffect(() => {
    fetchFarmers();
    fetchMilkTypes();
  }, []);

  const fetchFarmers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .eq("user_type", "farmer")
        .eq("status", "approved");

      if (error) throw error;
      setFarmers(data || []);
    } catch (error) {
      console.error("Error fetching farmers:", error);
      toast({
        title: "Error",
        description: "Failed to load farmers",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMilkTypes = async () => {
    try {
      const { data, error } = await supabase
        .from("milk_pricing")
        .select("milk_type");

      if (error) throw error;
      setMilkTypes(data?.map((item) => item.milk_type) || ["cow"]);
    } catch (error) {
      console.error("Error fetching milk types:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFarmer || !selectedMilkType || quantity <= 0) {
      toast({
        title: "Validation Error",
        description: "Please fill all required fields with valid values.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);

      // 1. Get milk price for the selected milk type
      const { data: priceData, error: priceError } = await supabase
        .from("milk_pricing")
        .select("price_per_liter")
        .eq("milk_type", selectedMilkType)
        .single();

      if (priceError) throw priceError;
      
      const milkPrice = priceData.price_per_liter;
      const totalAmount = quantity * milkPrice;
      
      // 2. Create payment entry in the farmer_payments table
      const { data: paymentData, error: paymentError } = await supabase
        .from("farmer_payments")
        .insert({
          farmer_id: selectedFarmer,
          amount: totalAmount,
          status: "pending",
          notes: `Payment for ${quantity}L of ${selectedMilkType} milk collection on ${format(new Date(), "MMM dd, yyyy")}`
        })
        .select();
      
      if (paymentError) throw paymentError;

      // 3. Insert the milk contribution with payment ID reference
      const { data: contributionData, error: contributionError } = await supabase
        .from("milk_contributions")
        .insert({
          farmer_id: selectedFarmer,
          milk_type: selectedMilkType,
          quantity: quantity,
          quality_rating: qualityRating,
          contribution_date: new Date().toISOString().split("T")[0],
          payment_id: paymentData?.[0]?.id // Link to the payment
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
        title: "Success",
        description: `Collected ${quantity}L of milk from farmer successfully.`,
      });

      // Reset form
      setSelectedFarmer("");
      setQuantity(0);
      setQualityRating(1);
    } catch (error) {
      console.error("Error collecting milk:", error);
      toast({
        title: "Error",
        description: "Failed to record milk collection",
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
          Collect Milk
        </CardTitle>
        <CardDescription>
          Record milk collected from farmers
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="farmer">Select Farmer</Label>
            <Select
              value={selectedFarmer}
              onValueChange={setSelectedFarmer}
              disabled={isLoading || farmers.length === 0}
            >
              <SelectTrigger id="farmer">
                <SelectValue placeholder="Select a farmer" />
              </SelectTrigger>
              <SelectContent>
                {farmers.map((farmer) => (
                  <SelectItem key={farmer.id} value={farmer.id}>
                    {farmer.first_name && farmer.last_name
                      ? `${farmer.first_name} ${farmer.last_name}`
                      : farmer.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="milk-type">Milk Type</Label>
            <Select value={selectedMilkType} onValueChange={setSelectedMilkType}>
              <SelectTrigger id="milk-type">
                <SelectValue placeholder="Select milk type" />
              </SelectTrigger>
              <SelectContent>
                {milkTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="quantity">Quantity (Liters)</Label>
            <Input
              id="quantity"
              type="number"
              min="0"
              step="0.1"
              value={quantity}
              onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="quality">Quality Rating</Label>
            <Select 
              value={qualityRating.toString()} 
              onValueChange={(value) => setQualityRating(parseInt(value))}
            >
              <SelectTrigger id="quality" className="flex items-center">
                <Beaker className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Select quality rating" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">A - Excellent Quality</SelectItem>
                <SelectItem value="2">B - Good Quality</SelectItem>
                <SelectItem value="3">C - Below Standard</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isSubmitting || !selectedFarmer}>
            {isSubmitting ? "Collecting..." : "Collect Milk"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};
