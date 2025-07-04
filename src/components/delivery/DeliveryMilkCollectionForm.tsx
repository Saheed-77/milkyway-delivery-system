import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { submitMilkCollection } from "@/lib/rpc";
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

interface FarmerOption {
  farmer_id: number;
  profile: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
}

/**
 * Delivery-staff milk collection. Uses the same atomic staff-only
 * `submit_milk_collection` RPC as the admin form: quality gating,
 * blacklisting and stock updates all happen server-side.
 */
export const DeliveryMilkCollectionForm = () => {
  const [farmers, setFarmers] = useState<FarmerOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const [selectedFarmer, setSelectedFarmer] = useState("");
  const [selectedMilkType, setSelectedMilkType] = useState("cow");
  const [quantity, setQuantity] = useState("");
  const [qualityRating, setQualityRating] = useState("1");

  const fetchFarmers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("farmers")
        .select(
          `
          farmer_id,
          profile:profiles!id (
            first_name,
            last_name,
            email
          )
        `
        )
        .order("farmer_id");

      if (error) throw error;
      setFarmers((data ?? []) as unknown as FarmerOption[]);
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
  }, [toast]);

  useEffect(() => {
    void fetchFarmers();
  }, [fetchFarmers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const qty = Number.parseFloat(quantity);
    const rating = Number.parseInt(qualityRating, 10);
    const farmerCode = Number.parseInt(selectedFarmer, 10);

    if (!Number.isFinite(farmerCode) || !Number.isFinite(qty) || qty <= 0 || qty > 10000) {
      toast({
        title: "Validation Error",
        description: "Please fill all required fields with valid values.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await submitMilkCollection({
        farmerCode,
        quantity: qty,
        qualityRating: rating,
        milkType: selectedMilkType,
      });

      if (result.outcome === "recorded") {
        toast({
          title: "Success",
          description: `Collected ${qty}L of milk from ${result.farmer_name || "farmer"} successfully.`,
        });
      } else if (result.outcome === "substandard") {
        toast({
          title: "Substandard Milk",
          description: `Offense ${result.offense_count} of 3 recorded. The milk was not added to inventory.`,
        });
      } else {
        toast({
          title: "Farmer Blacklisted",
          description: `${result.farmer_name || "The farmer"} has been blacklisted after ${result.offense_count} consecutive substandard submissions.`,
          variant: "destructive",
        });
      }

      setSelectedFarmer("");
      setQuantity("");
      setQualityRating("1");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to record milk collection";
      toast({ title: "Error", description: message, variant: "destructive" });
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
        <CardDescription>Record milk collected from farmers</CardDescription>
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
                  <SelectItem key={farmer.farmer_id} value={String(farmer.farmer_id)}>
                    {farmer.profile?.first_name && farmer.profile?.last_name
                      ? `${farmer.profile.first_name} ${farmer.profile.last_name}`
                      : farmer.profile?.email || `Farmer #${farmer.farmer_id}`}
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
                <SelectItem value="cow">Cow</SelectItem>
                <SelectItem value="buffalo">Buffalo</SelectItem>
                <SelectItem value="goat">Goat</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="quantity">Quantity (Liters)</Label>
            <Input
              id="quantity"
              type="number"
              min="0.1"
              max="10000"
              step="0.1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="quality">Quality Rating</Label>
            <Select value={qualityRating} onValueChange={setQualityRating}>
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
