
import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Repeat, Plus } from "lucide-react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const SubscriptionsList = () => {
  const [subscriptions, setSubscriptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [newSubscription, setNewSubscription] = useState({
    productId: "",
    quantity: "1",
    frequency: "daily"
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchSubscriptions();
    fetchProducts();
  }, []);

  const fetchSubscriptions = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from("subscriptions")
        .select(`
          *,
          product:products (
            name,
            price,
            milk_type
          )
        `)
        .eq("customer_id", session.user.id)
        .neq("status", "cancelled") // Don't show cancelled subscriptions
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSubscriptions(data || []);
    } catch (error) {
      console.error("Error fetching subscriptions:", error);
      toast({
        title: "Error",
        description: "Failed to load your subscriptions. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("name");

      if (error) throw error;
      setProducts(data || []);
      if (data && data.length > 0) {
        setNewSubscription(prev => ({ ...prev, productId: data[0].id }));
      }
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  const cancelSubscription = async (subscriptionId) => {
    setIsCancelling(true);
    try {
      const { error } = await supabase
        .from("subscriptions")
        .update({ status: "cancelled" })
        .eq("id", subscriptionId);

      if (error) throw error;

      // Update the subscriptions list by removing the cancelled subscription
      setSubscriptions(subscriptions.filter(sub => sub.id !== subscriptionId));

      toast({
        title: "Subscription cancelled",
        description: "Your subscription has been successfully cancelled.",
      });
    } catch (error) {
      console.error("Error cancelling subscription:", error);
      toast({
        title: "Error",
        description: "Failed to cancel subscription. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const createSubscription = async () => {
    setIsCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("You must be logged in to create a subscription");
      }

      // Get the product for price information
      const { data: productData, error: productError } = await supabase
        .from("products")
        .select("*")
        .eq("id", newSubscription.productId)
        .single();

      if (productError) throw productError;
      
      // Calculate next delivery date (tomorrow)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { error } = await supabase.from("subscriptions").insert({
        customer_id: session.user.id,
        product_id: newSubscription.productId,
        quantity: parseInt(newSubscription.quantity),
        frequency: newSubscription.frequency,
        next_delivery: tomorrow.toISOString(),
        status: "active"
      });

      if (error) throw error;

      toast({
        title: "Subscription Created",
        description: "Your new subscription has been successfully created.",
      });

      // Close dialog and refresh subscriptions
      setIsDialogOpen(false);
      fetchSubscriptions();
    } catch (error) {
      console.error("Error creating subscription:", error);
      toast({
        title: "Error",
        description: "Failed to create subscription. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const getNextDeliveryText = (subscription) => {
    if (!subscription.next_delivery) return "Not scheduled";
    
    const nextDelivery = new Date(subscription.next_delivery);
    const today = new Date();
    
    // Check if the delivery is today
    if (nextDelivery.toDateString() === today.toDateString()) {
      return "Today";
    }
    
    // Check if the delivery is tomorrow
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (nextDelivery.toDateString() === tomorrow.toDateString()) {
      return "Tomorrow";
    }
    
    // Otherwise show the date
    return format(nextDelivery, "MMM dd, yyyy");
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center">
          <Repeat className="h-5 w-5 mr-2 text-[#437358]" />
          Active Subscriptions
        </CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="flex items-center gap-1">
              <Plus className="h-4 w-4" />
              <span>New</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Subscription</DialogTitle>
              <DialogDescription>
                Set up a recurring milk delivery subscription.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="product">Product</Label>
                <Select 
                  value={newSubscription.productId} 
                  onValueChange={(value) => setNewSubscription(prev => ({ ...prev, productId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Product" />
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
              <div className="grid gap-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={newSubscription.quantity}
                  onChange={(e) => setNewSubscription(prev => ({ ...prev, quantity: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="frequency">Delivery Frequency</Label>
                <Select 
                  value={newSubscription.frequency} 
                  onValueChange={(value) => setNewSubscription(prev => ({ ...prev, frequency: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button 
                onClick={createSubscription} 
                disabled={isCreating || !newSubscription.productId}
                className="bg-[#437358] hover:bg-[#345c46]"
              >
                {isCreating ? "Creating..." : "Create Subscription"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Loading subscriptions...</p>
        ) : subscriptions.length === 0 ? (
          <div className="text-center py-8">
            <Repeat className="h-12 w-12 mx-auto text-muted-foreground opacity-20" />
            <p className="mt-2 text-muted-foreground">No active subscriptions</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-4"
              onClick={() => setIsDialogOpen(true)}
            >
              Create a subscription
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {subscriptions.map((subscription) => (
              <div 
                key={subscription.id} 
                className="p-3 border rounded-lg flex justify-between items-center"
              >
                <div>
                  <h4 className="font-medium">
                    {subscription.quantity}× {subscription.product?.name || `${subscription.product?.milk_type || "Unknown"} Milk`}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {subscription.frequency} • ₹{(subscription.product?.price * subscription.quantity).toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Next delivery: {getNextDeliveryText(subscription)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    disabled={isCancelling}
                    onClick={() => cancelSubscription(subscription.id)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
