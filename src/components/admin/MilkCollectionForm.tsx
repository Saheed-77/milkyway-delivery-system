import { useState } from "react";
import { submitMilkCollection, type CollectionResult } from "@/lib/rpc";
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

/**
 * Admin milk collection intake. The entire workflow — farmer lookup by
 * public ID, quality gate, blacklisting after 3 consecutive substandard
 * submissions, contribution + stock updates — runs atomically in the
 * `submit_milk_collection` RPC (staff-only, SECURITY DEFINER).
 */
export const MilkCollectionForm = () => {
  const [farmerId, setFarmerId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [qualityRating, setQualityRating] = useState("");
  const [milkType, setMilkType] = useState("cow");
  const [isLoading, setIsLoading] = useState(false);
  const [blacklistInfo, setBlacklistInfo] = useState<CollectionResult | null>(null);
  const { toast } = useToast();

  const resetForm = () => {
    setFarmerId("");
    setQuantity("");
    setQualityRating("");
    setMilkType("cow");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const code = Number.parseInt(farmerId, 10);
    const qty = Number.parseFloat(quantity);
    const rating = Number.parseInt(qualityRating, 10);

    if (!Number.isFinite(code) || code <= 0) {
      toast({
        title: "Invalid Farmer ID",
        description: "Enter the farmer's numeric ID.",
        variant: "destructive",
      });
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0 || qty > 10000) {
      toast({
        title: "Invalid quantity",
        description: "Enter a quantity between 0.1 and 10,000 liters.",
        variant: "destructive",
      });
      return;
    }
    if (!Number.isFinite(rating) || rating < 1 || rating > 3) {
      toast({
        title: "Missing quality rating",
        description: "Select a quality rating.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const result = await submitMilkCollection({
        farmerCode: code,
        quantity: qty,
        qualityRating: rating,
        milkType,
      });

      switch (result.outcome) {
        case "blacklisted":
          setBlacklistInfo(result);
          toast({
            title: "Farmer Blacklisted",
            description:
              "This farmer has been blacklisted due to repeated substandard milk submissions.",
            variant: "destructive",
          });
          break;
        case "substandard":
          toast({
            title: "Substandard Milk Detected",
            description: `Offense ${result.offense_count} of 3. The milk was not added to inventory, but the submission was recorded.`,
          });
          break;
        default:
          toast({
            title: "Success!",
            description: "Milk collection recorded and stock updated.",
          });
      }

      resetForm();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to record milk collection";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
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
                inputMode="numeric"
                value={farmerId}
                onChange={(e) => setFarmerId(e.target.value)}
                placeholder="Enter Farmer ID"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter the numeric Farmer ID (not UUID)
              </p>
            </div>

            <div>
              <label htmlFor="milkType" className="block text-sm font-medium text-gray-700 mb-1">
                Milk Type
              </label>
              <Select value={milkType} onValueChange={setMilkType}>
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
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Enter quantity in liters"
                min="0.1"
                max="10000"
                step="0.1"
                required
              />
            </div>
            <div>
              <label
                htmlFor="qualityRating"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Quality Rating
              </label>
              <Select value={qualityRating} onValueChange={setQualityRating}>
                <SelectTrigger id="qualityRating">
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

      <Dialog open={blacklistInfo !== null} onOpenChange={(open) => !open && setBlacklistInfo(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center text-red-600">
              <AlertTriangle className="mr-2 h-5 w-5" />
              Farmer Blacklisted
            </DialogTitle>
            <DialogDescription>
              This farmer has been automatically blacklisted due to 3 consecutive substandard
              milk submissions.
            </DialogDescription>
          </DialogHeader>

          {blacklistInfo && (
            <div className="space-y-4 py-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Name:</p>
                <p className="text-sm">{blacklistInfo.farmer_name || "Unknown"}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-500">Email:</p>
                <p className="text-sm">{blacklistInfo.farmer_email || "No email available"}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-red-600">Consecutive offenses:</p>
                <p className="text-sm font-bold">
                  {blacklistInfo.offense_count} substandard submissions
                </p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                <p className="text-sm text-amber-800">
                  This farmer's account has been automatically rejected and they will no longer
                  be able to submit milk. You may need to contact them directly to discuss this
                  issue.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setBlacklistInfo(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
