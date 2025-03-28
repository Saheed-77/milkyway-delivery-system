
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface MilkTypeSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export const MilkTypeSelector = ({ value, onChange }: MilkTypeSelectorProps) => {
  return (
    <div className="space-y-2">
      <Label htmlFor="milkType">Milk Type</Label>
      <Select 
        value={value} 
        onValueChange={onChange}
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
  );
};
