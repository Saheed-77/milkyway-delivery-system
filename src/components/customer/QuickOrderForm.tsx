
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { MilkTypeSelector } from "./order/MilkTypeSelector";
import { QuantityInput } from "./order/QuantityInput";
import { PaymentMethodSelector } from "./order/PaymentMethodSelector";
import { OrderSummary } from "./order/OrderSummary";
import { useOrderLogic } from "./order/useOrderLogic";

interface QuickOrderFormProps {
  onOrderComplete?: () => void;
}

export const QuickOrderForm = ({ onOrderComplete }: QuickOrderFormProps) => {
  const {
    quantity,
    setQuantity,
    milkType,
    setMilkType,
    paymentMethod,
    setPaymentMethod,
    isLoading,
    walletBalance,
    estimatedCost,
    insufficientFunds,
    handleSubmit
  } = useOrderLogic(onOrderComplete);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Order</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <MilkTypeSelector 
            value={milkType} 
            onChange={setMilkType} 
          />
          
          <QuantityInput 
            value={quantity} 
            onChange={(e) => setQuantity(e.target.value)} 
          />

          <PaymentMethodSelector 
            value={paymentMethod} 
            onChange={setPaymentMethod} 
            walletBalance={walletBalance} 
          />

          <OrderSummary 
            estimatedCost={estimatedCost}
            insufficientFunds={insufficientFunds}
            paymentMethod={paymentMethod}
            walletBalance={walletBalance}
          />

          <CardFooter className="px-0 pt-2">
            <Button 
              type="submit" 
              className="w-full bg-[#437358] hover:bg-[#345c46]"
              disabled={isLoading || (paymentMethod === "wallet" && insufficientFunds)}
            >
              {isLoading ? "Processing..." : "Place Order"}
            </Button>
          </CardFooter>
        </form>
      </CardContent>
    </Card>
  );
};
