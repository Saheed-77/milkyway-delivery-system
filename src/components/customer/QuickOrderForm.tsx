
import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShoppingBag, AlertCircle, Wallet, Banknote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StockReservation } from "@/types/milk";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const QuickOrderForm = ({ onOrderComplete }) => {
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("wallet");
  const [insufficientFunds, setInsufficientFunds] = useState(false);
  const [insufficientStock, setInsufficientStock] = useState(false);
  const [availableStock, setAvailableStock] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    fetchProducts();
    fetchWalletBalance();
  }, []);

  useEffect(() => {
    if (selectedProduct && quantity) {
      checkStockAvailability(selectedProduct.milk_type, quantity);
      validateWalletBalance();
    }
  }, [selectedProduct, quantity, paymentMethod]);

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
    } catch (error) {
      console.error("Error fetching wallet balance:", error);
    }
  };

  const fetchProducts = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("name");

      if (error) throw error;
      setProducts(data || []);
      setSelectedProduct(data?.[0] || null);
      
      if (data?.[0]) {
        checkStockAvailability(data[0].milk_type, quantity);
      }
    } catch (error) {
      console.error("Error fetching products:", error);
      toast({
        title: "Error",
        description: "Failed to load products. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const validateWalletBalance = () => {
    if (!selectedProduct) return;
    
    const orderTotal = selectedProduct.price * quantity;
    const hasInsufficientFunds = paymentMethod === "wallet" && orderTotal > walletBalance;
    setInsufficientFunds(hasInsufficientFunds);
  };

  const checkStockAvailability = async (milkType, quantity) => {
    try {
      // Try to use the check_stock_availability function
      const { data: isAvailable, error: availabilityError } = await supabase
        .rpc('check_stock_availability', { requested_quantity: Number(quantity) });
        
      if (!availabilityError) {
        setInsufficientStock(!isAvailable);
        
        // Get the available stock amount for display
        const { data: stockData } = await supabase
          .from("milk_stock")
          .select("total_stock")
          .single();
          
        // Get reserved amount
        const { data: reservations } = await supabase
          .from('stock_reservations')
          .select('reserved_amount')
          .gte('reservation_date', new Date().toISOString().split('T')[0])
          .order('reservation_date', { ascending: false });
          
        const reservedAmount = reservations && reservations.length > 0
          ? reservations.reduce((sum, res) => sum + Number(res.reserved_amount), 0)
          : 0;
          
        const available = (stockData?.total_stock || 0) - reservedAmount;
        setAvailableStock(Math.max(0, available));
        return;
      }
      
      // Fallback: direct calculation
      // Get total milk stock
      const { data: stockData, error: stockError } = await supabase
        .from("milk_stock")
        .select("total_stock")
        .single();
        
      if (stockError) throw stockError;
      
      // Get reservations
      let reservedAmount = 0;
      
      try {
        const { data: reservations } = await supabase
          .from('stock_reservations')
          .select('reserved_amount')
          .gte('reservation_date', new Date().toISOString().split('T')[0]);
          
        if (reservations && reservations.length > 0) {
          reservedAmount = reservations.reduce((sum, res) => sum + Number(res.reserved_amount), 0);
        }
      } catch (err) {
        console.log("Error getting reservations:", err);
      }
      
      // Calculate available stock after reservations
      const availableStock = Math.max(0, (stockData?.total_stock || 0) - reservedAmount);
      setAvailableStock(availableStock);
      setInsufficientStock(availableStock < quantity);
    } catch (error) {
      console.error("Error checking stock availability:", error);
      // Default to available in case of error to not block orders
      setInsufficientStock(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProduct || quantity <= 0) {
      toast({
        title: "Validation Error",
        description: "Please select a product and enter a valid quantity.",
        variant: "destructive",
      });
      return;
    }

    // Final validation checks
    if (insufficientStock) {
      toast({
        title: "Insufficient Stock",
        description: `Sorry, we only have ${availableStock}L available. Please reduce your order quantity.`,
        variant: "destructive",
      });
      return;
    }
    
    if (paymentMethod === "wallet" && insufficientFunds) {
      toast({
        title: "Insufficient Funds",
        description: `You need ₹${(selectedProduct.price * quantity - walletBalance).toFixed(2)} more in your wallet to complete this order.`,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("You must be logged in to place an order");
      }

      // Create a new order
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .insert({
          customer_id: session.user.id,
          total_amount: selectedProduct.price * quantity,
          status: "pending",
          payment_method: paymentMethod,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const { error: orderItemError } = await supabase
        .from("order_items")
        .insert({
          order_id: orderData.id,
          product_id: selectedProduct.id,
          quantity: Number(quantity),
          unit_price: selectedProduct.price,
        });

      if (orderItemError) throw orderItemError;
      
      // If payment is through wallet, create a wallet transaction
      if (paymentMethod === "wallet") {
        const { error: walletError } = await supabase
          .from("wallet_transactions")
          .insert({
            user_id: session.user.id,
            amount: selectedProduct.price * quantity,
            transaction_type: "order",
            status: "completed"
          });
          
        if (walletError) throw walletError;
        
        // Update local wallet balance
        setWalletBalance(prev => prev - (selectedProduct.price * quantity));
      }

      toast({
        title: "Order placed",
        description: `Your order has been successfully placed with ${paymentMethod === "wallet" ? "wallet payment" : "cash on delivery"}.`,
      });

      // Reset form
      setQuantity(1);
      setInsufficientFunds(false);
      setInsufficientStock(false);

      // Notify parent component
      onOrderComplete?.();
    } catch (error) {
      console.error("Error placing order:", error);
      toast({
        title: "Error",
        description: "Failed to place order. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getEstimatedCost = () => {
    if (!selectedProduct) return 0;
    return selectedProduct.price * quantity;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center">
          <ShoppingBag className="h-5 w-5 mr-2 text-[#437358]" />
          Quick Order
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-muted-foreground">Loading products...</p>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="product">Product</Label>
              <Select
                value={selectedProduct?.id}
                onValueChange={(value) =>
                  setSelectedProduct(
                    products.find((product) => product.id === value) || null
                  )
                }
                disabled={isLoading || products.length === 0}
              >
                <SelectTrigger id="product">
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name || product.milk_type} Milk - ₹{product.price}
                    </SelectItem>
                  ))}
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
                onChange={(e) => setQuantity(Number(e.target.value))}
                disabled={isLoading}
              />
            </div>
            
            {insufficientStock && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Not enough stock available. We only have {availableStock}L in stock.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label>Payment Method</Label>
              <RadioGroup
                value={paymentMethod}
                onValueChange={setPaymentMethod}
                className="space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="wallet" id="wallet" />
                  <Label htmlFor="wallet" className="flex items-center">
                    <Wallet className="h-4 w-4 mr-2" />
                    Wallet (₹{walletBalance.toFixed(2)})
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="cod" id="cod" />
                  <Label htmlFor="cod" className="flex items-center">
                    <Banknote className="h-4 w-4 mr-2" />
                    Cash on Delivery
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="mt-3 flex justify-between text-sm">
              <span>Estimated Cost:</span>
              <span className="font-medium">₹{getEstimatedCost().toFixed(2)}</span>
            </div>

            {paymentMethod === "wallet" && insufficientFunds && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Insufficient funds. Please add at least ₹{(getEstimatedCost() - walletBalance).toFixed(2)} to your wallet or choose Cash on Delivery.
                </AlertDescription>
              </Alert>
            )}

            <Button
              className="w-full bg-[#437358] hover:bg-[#345c46]"
              onClick={handleSubmit}
              disabled={
                isSubmitting || 
                !selectedProduct || 
                quantity <= 0 || 
                (paymentMethod === "wallet" && insufficientFunds) ||
                insufficientStock
              }
            >
              {isSubmitting ? "Placing Order..." : "Place Order"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};
