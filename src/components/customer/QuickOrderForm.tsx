
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export const QuickOrderForm = () => {
  const [quantity, setQuantity] = useState("1");
  const [milkType, setMilkType] = useState("cow");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

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

      // 3. Use the first product of the selected milk type
      const selectedProduct = products[0];
      const totalAmount = selectedProduct.price * parseInt(quantity);

      // 4. Create order
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .insert({
          customer_id: session.user.id,
          total_amount: totalAmount,
          status: "pending"
        })
        .select()
        .single();

      if (orderError) {
        console.error("Order error:", orderError);
        throw new Error("Error creating order: " + orderError.message);
      }

      // 5. Create order item
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

      toast({
        title: "Order Placed!",
        description: `Your order for ${quantity} unit(s) of ${milkType} milk has been submitted.`,
      });

      // Reset form
      setQuantity("1");
      
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

          <CardFooter className="px-0 pt-2">
            <Button 
              type="submit" 
              className="w-full bg-[#437358] hover:bg-[#345c46]"
              disabled={isLoading}
            >
              {isLoading ? "Processing..." : "Place Order"}
            </Button>
          </CardFooter>
        </form>
      </CardContent>
    </Card>
  );
};
