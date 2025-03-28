
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface PaymentMethodSelectorProps {
  value: string;
  onChange: (value: string) => void;
  walletBalance: number;
}

export const PaymentMethodSelector = ({ value, onChange, walletBalance }: PaymentMethodSelectorProps) => {
  return (
    <div className="space-y-2">
      <Label>Payment Method</Label>
      <RadioGroup 
        value={value} 
        onValueChange={onChange}
        className="flex flex-col space-y-1"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="wallet" id="wallet-payment" />
          <Label htmlFor="wallet-payment" className="cursor-pointer">Wallet (₹{walletBalance.toFixed(2)})</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="cod" id="cod-payment" />
          <Label htmlFor="cod-payment" className="cursor-pointer">Cash on Delivery</Label>
        </div>
      </RadioGroup>
    </div>
  );
};
