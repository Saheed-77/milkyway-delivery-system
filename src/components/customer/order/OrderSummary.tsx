
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface OrderSummaryProps {
  estimatedCost: number;
  insufficientFunds: boolean;
  paymentMethod: string;
  walletBalance: number;
}

export const OrderSummary = ({ 
  estimatedCost, 
  insufficientFunds, 
  paymentMethod,
  walletBalance 
}: OrderSummaryProps) => {
  return (
    <div className="space-y-2">
      <div className="mt-3 flex justify-between text-sm">
        <span>Estimated Cost:</span>
        <span className="font-medium">₹{estimatedCost.toFixed(2)}</span>
      </div>

      {paymentMethod === "wallet" && insufficientFunds && (
        <Alert variant="destructive" className="mt-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Insufficient funds. Please add at least ₹{(estimatedCost - walletBalance).toFixed(2)} to your wallet or choose Cash on Delivery.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
