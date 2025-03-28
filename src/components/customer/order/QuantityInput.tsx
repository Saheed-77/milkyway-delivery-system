
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface QuantityInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const QuantityInput = ({ value, onChange }: QuantityInputProps) => {
  return (
    <div className="space-y-2">
      <Label htmlFor="quantity">Quantity</Label>
      <Input
        id="quantity"
        type="number"
        min="1"
        value={value}
        onChange={onChange}
      />
    </div>
  );
};
