import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { getWalletBalance, placeOrder, checkStockAvailability } from "@/lib/rpc";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Product {
  id: string;
  name: string | null;
  milk_type: string;
  price: number;
}

interface QuickOrderFormProps {
  onOrderComplete?: () => void;
}

/**
 * Quick order form. The client shows estimates only; the `place_order` RPC
 * recomputes price, re-checks stock and debits the wallet atomically.
 */
export const QuickOrderForm = ({ onOrderComplete }: QuickOrderFormProps) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "cash">("wallet");
  const [insufficientStock, setInsufficientStock] = useState(false);
  const { toast } = useToast();

  const parsedQuantity = Number.parseInt(quantity, 10);
  const isQuantityValid =
    Number.isFinite(parsedQuantity) && parsedQuantity >= 1 && parsedQuantity <= 100;

  const estimatedCost = selectedProduct && isQuantityValid
    ? selectedProduct.price * parsedQuantity
    : 0;
  const insufficientFunds =
    paymentMethod === "wallet" && estimatedCost > 0 && estimatedCost > walletBalance;

  const fetchWalletBalance = useCallback(async () => {
    try {
      const balance = await getWalletBalance();
      setWalletBalance(balance ?? 0);
    } catch (error) {
      console.error("Error fetching wallet balance:", error);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("products")
        .select("id, name, milk_type, price")
        .order("name");

      if (error) throw error;
      const list = (data ?? []) as Product[];
      setProducts(list);
      setSelectedProduct(list[0] ?? null);
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
  }, [toast]);

  useEffect(() => {
    void fetchProducts();
    void fetchWalletBalance();
  }, [fetchProducts, fetchWalletBalance]);

  useEffect(() => {
    if (!isQuantityValid) return;
    let cancelled = false;
    checkStockAvailability(parsedQuantity)
      .then((available) => {
        if (!cancelled) setInsufficientStock(!available);
      })
      .catch(() => {
        // Don't block the form on a failed pre-check; place_order re-verifies.
        if (!cancelled) setInsufficientStock(false);
      });
    return () => {
      cancelled = true;
    };
  }, [parsedQuantity, isQuantityValid]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !isQuantityValid) {
      toast({
        title: "Validation Error",
        description: "Please select a product and enter a quantity between 1 and 100.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await placeOrder({
        milkType: selectedProduct.milk_type,
        quantity: parsedQuantity,
        paymentMethod,
      });

      toast({
        title: "Order placed",
        description: `Your order has been successfully placed with ${
          paymentMethod === "wallet" ? "wallet payment" : "cash on delivery"
        }.`,
      });

      setQuantity("1");
      await fetchWalletBalance();
      onOrderComplete?.();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to place order. Please try again.";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
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
                value={selectedProduct?.id ?? ""}
                onValueChange={(value) =>
                  setSelectedProduct(products.find((p) => p.id === value) ?? null)
                }
                disabled={products.length === 0}
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
                max="100"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>

            {insufficientStock && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Not enough stock available today for this quantity.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label>Payment Method</Label>
              <RadioGroup
                value={paymentMethod}
                onValueChange={(value) => setPaymentMethod(value as "wallet" | "cash")}
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
                  <RadioGroupItem value="cash" id="cash" />
                  <Label htmlFor="cash" className="flex items-center">
                    <Banknote className="h-4 w-4 mr-2" />
                    Cash on Delivery
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="mt-3 flex justify-between text-sm">
              <span>Estimated Cost:</span>
              <span className="font-medium">₹{estimatedCost.toFixed(2)}</span>
            </div>

            {insufficientFunds && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Insufficient funds. Please add at least ₹
                  {(estimatedCost - walletBalance).toFixed(2)} to your wallet or choose Cash on
                  Delivery.
                </AlertDescription>
              </Alert>
            )}

            <Button
              className="w-full bg-[#437358] hover:bg-[#345c46]"
              onClick={handleSubmit}
              disabled={
                isSubmitting ||
                !selectedProduct ||
                !isQuantityValid ||
                insufficientFunds ||
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
