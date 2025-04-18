
import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StockReservation } from "@/types/milk";

// Define an interface for the reservation data
export const QuickOrderForm = ({ onOrderComplete }) => {
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchProducts();
  }, []);

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

  // Add this validation function to check stock availability 
  const checkStockAvailability = async (milkType, quantity) => {
    try {
      // Get total milk stock
      const { data: stockData, error: stockError } = await supabase
        .from("milk_stock")
        .select("total_stock")
        .single();
        
      if (stockError) throw stockError;
      
      // Try to use the RPC function
      try {
        const { data: isAvailable, error: availabilityError } = await supabase
          .rpc('check_stock_availability', { requested_quantity: quantity });
          
        if (!availabilityError) {
          return {
            available: isAvailable,
            availableQuantity: stockData?.total_stock || 0
          };
        }
      } catch (err) {
        console.log("RPC check failed, using direct query");
      }
      
      // If RPC fails, try to get reserved amount directly - handle safely if table doesn't exist
      let reservedAmount = 0;
      
      try {
        const { data: reservations, error: reservationsError } = await supabase
          .rpc('get_stock_reservations');
          
        if (!reservationsError && reservations && reservations.length > 0) {
          reservedAmount = reservations[0].reserved_amount || 0;
        } else {
          // Try direct query as any to avoid type errors
          const { data: rawReservations } = await supabase
            .from('stock_reservations')
            .select('*')
            .order('reservation_date', { ascending: false })
            .limit(1) as { data: any[] };
            
          if (rawReservations && rawReservations.length > 0) {
            reservedAmount = rawReservations[0].reserved_amount || 0;
          }
        }
      } catch (err) {
        console.log("No stock reservations found, checking against total stock");
      }
      
      // Calculate available stock after reservations
      const availableStock = (stockData?.total_stock || 0) - reservedAmount;
      
      return {
        available: availableStock >= quantity,
        availableQuantity: availableStock
      };
    } catch (error) {
      console.error("Error checking stock availability:", error);
      // Default to available in case of error to not block orders
      return { available: true, availableQuantity: 0 };
    }
  };

  // In the handleSubmit function, add stock availability check before processing the order
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

    setIsSubmitting(true);
    try {
      // Check stock availability first
      const stockCheck = await checkStockAvailability(selectedProduct.milk_type, quantity);
      
      if (!stockCheck.available) {
        toast({
          title: "Insufficient Stock",
          description: `Sorry, we only have ${stockCheck.availableQuantity}L available. Please reduce your order quantity.`,
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
      
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
          payment_method: "wallet",
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
          quantity: quantity,
          unit_price: selectedProduct.price,
        });

      if (orderItemError) throw orderItemError;

      toast({
        title: "Order placed",
        description: "Your order has been successfully placed.",
      });

      // Reset form
      setQuantity(1);

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

            <Button
              className="w-full bg-[#437358] hover:bg-[#345c46]"
              onClick={handleSubmit}
              disabled={isSubmitting || !selectedProduct}
            >
              {isSubmitting ? "Placing Order..." : "Place Order"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};
