import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { recordMilkContribution } from "@/lib/rpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MilkContributionFormProps {
  onRecorded?: () => void;
}

export const MilkContributionForm = ({ onRecorded }: MilkContributionFormProps) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [milkType, setMilkType] = useState("cow");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsed = Number.parseFloat(quantity);
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 10000) {
      toast({
        title: "Invalid quantity",
        description: "Enter a quantity between 0.1 and 10,000 liters.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await recordMilkContribution({ quantity: parsed, milkType });

      toast({
        title: "Contribution recorded",
        description: `Successfully added ${parsed} liters of ${milkType} milk. Request payment from the Payments tab once you're ready.`,
      });

      setQuantity("");
      onRecorded?.();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "An unexpected error occurred.";
      toast({
        title: "Error recording contribution",
        description: message,
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
        <Select value={milkType} onValueChange={setMilkType} disabled={isSubmitting}>
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
          min="0.1"
          max="10000"
          step="0.1"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          disabled={isSubmitting}
          required
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
