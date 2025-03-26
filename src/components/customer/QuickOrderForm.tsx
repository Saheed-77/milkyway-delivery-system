
import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export const QuickOrderForm = ({ onOrderComplete }) => {
  const [quantity, setQuantity] = useState("1");
  const [milkType, setMilkType] = useState("cow");
  const [paymentMethod, setPaymentMethod] = useState("wallet");
  const [isLoading, setIsLoading] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [estimatedCost, setEstimatedCost] = useState(0);
  const [insufficientFunds, setInsufficientFunds] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchWalletBalance();
    estimateOrderCost();
  }, [milkType, quantity, paymentMethod]);

  const fetchWalletBalance = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Get all wallet transactions for the user
      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("amount, transaction_type, status")
        .eq("user_id", session.user.id)
        .eq("status", "completed");

      if (error) throw error;

      // Calculate balance from transactions
      const calculatedBalance = data?.reduce((total, transaction) => {
        if (transaction.transaction_type === "deposit") {
          return total + transaction.amount;
        } else if (transaction.transaction_type === "withdrawal") {
          return total - transaction.amount;
        }
        return total;
      }, 0) || 0;

      setWalletBalance(calculatedBalance);
      
      // Only check for insufficient funds when using wallet payment
      if (paymentMethod === "wallet") {
        setInsufficientFunds(calculatedBalance < estimatedCost);
      } else {
        setInsufficientFunds(false);
      }
    } catch (error) {
      console.error("Error fetching wallet balance:", error);
    }
  };

  const estimateOrderCost = async () => {
    try {
      // Fetch products of the selected milk type
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("*")
        .eq("milk_type", milkType)
        .order("price")
        .limit(1);
      
      if (productsError) {
        console.error("Products error:", productsError);
        return;
      }
      
      if (!products || products.length === 0) {
        setEstimatedCost(0);
        return;
      }

      // Calculate estimated cost
      const selectedProduct = products[0];
      const totalAmount = selectedProduct.price * parseInt(quantity);
      setEstimatedCost(totalAmount);
      
      // Only check for insufficient funds when using wallet payment
      if (paymentMethod === "wallet") {
        setInsufficientFunds(walletBalance < totalAmount);
      } else {
        setInsufficientFunds(false);
      }
    } catch (error) {
      console.error("Error estimating cost:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // 1. Get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error("Session error:", sessionError);
        throw new Error("Authentication error: " + sessionError.message);
      }
      
      if (!session) {
        throw new Error("You must be logged in to place an order");
      }

      // 2. Fetch products of the selected milk type
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("*")
        .eq("milk_type", milkType)
        .order("price")
        .limit(1);
      
      if (productsError) {
        console.error("Products error:", productsError);
        throw new Error("Error fetching products: " + productsError.message);
      }
      
      if (!products || products.length === 0) {
        throw new Error(`No ${milkType} milk products available`);
      }

      // 3. Calculate total amount
      const selectedProduct = products[0];
      const totalAmount = selectedProduct.price * parseInt(quantity);
      
      // 4. Check if wallet has sufficient funds when using wallet payment
      if (paymentMethod === "wallet") {
        // Refresh wallet balance
        await fetchWalletBalance();
        
        if (walletBalance < totalAmount) {
          throw new Error(`Insufficient funds. Please add at least ₹${(totalAmount - walletBalance).toFixed(2)} to your wallet or select Cash on Delivery.`);
        }
      }

      // 5. Create order
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .insert({
          customer_id: session.user.id,
          total_amount: totalAmount,
          status: "pending",
          // Add a flag to indicate payment method
          payment_method: paymentMethod
        })
        .select()
        .single();

      if (orderError) {
        console.error("Order error:", orderError);
        throw new Error("Error creating order: " + orderError.message);
      }

      // 6. Create order item
      const { data: orderItemData, error: itemError } = await supabase
        .from("order_items")
        .insert({
          order_id: orderData.id,
          product_id: selectedProduct.id,
          quantity: parseInt(quantity),
          unit_price: selectedProduct.price
        });

      if (itemError) {
        console.error("Order item error:", itemError);
        // Attempt to rollback the order
        await supabase
          .from("orders")
          .delete()
          .eq("id", orderData.id);
        throw new Error("Error adding item to order: " + itemError.message);
      }

      // 7. Only deduct from wallet if using wallet payment
      if (paymentMethod === "wallet") {
        const { error: walletError } = await supabase
          .from("wallet_transactions")
          .insert({
            user_id: session.user.id,
            amount: totalAmount,
            transaction_type: "withdrawal",
            status: "completed"
          });

        if (walletError) {
          console.error("Wallet error:", walletError);
          throw new Error("Error updating wallet: " + walletError.message);
        }

        // 8. Update wallet balance
        await fetchWalletBalance();
      }

      toast({
        title: "Order Placed!",
        description: `Your order for ${quantity} unit(s) of ${milkType} milk has been submitted with ${paymentMethod === "wallet" ? "wallet payment" : "cash on delivery"}.`,
      });

      // Reset form
      setQuantity("1");
      
      // Notify parent that order was completed to refresh order history
      if (onOrderComplete) {
        onOrderComplete();
      }
      
    } catch (error) {
      console.error("Error placing order:", error);
      toast({
        title: "Order Failed",
        description: error.message || "There was an error placing your order. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Order</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="milkType">Milk Type</Label>
            <Select 
              value={milkType} 
              onValueChange={setMilkType}
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
          
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Payment Method</Label>
            <RadioGroup 
              value={paymentMethod} 
              onValueChange={setPaymentMethod}
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
