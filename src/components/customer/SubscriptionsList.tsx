
import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Calendar, Milk, ArrowUpDown, Check, Plus } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Subscription {
  id: string;
  status: string;
  quantity: number;
  frequency: string;
  next_delivery: string | null;
  product: {
    id: string;
    name: string;
    price: number;
    description: string | null;
  };
}

interface Product {
  id: string;
  name: string;
  price: number;
  description: string | null;
  milk_type: string;
}

export const SubscriptionsList = () => {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [newSubscription, setNewSubscription] = useState({
    productId: "",
    quantity: "1",
    frequency: "daily"
  });
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchSubscriptions();
    fetchProducts();
    fetchWalletBalance();
  }, []);

  const fetchWalletBalance = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("amount, transaction_type")
        .eq("user_id", session.user.id)
        .eq("status", "completed");

      if (error) throw error;

      let balance = 0;
      if (data) {
        for (const transaction of data) {
          if (transaction.transaction_type === "deposit") {
            balance += transaction.amount;
          } else {
            balance -= transaction.amount;
          }
        }
      }
      
      setWalletBalance(balance);
    } catch (error) {
      console.error("Error fetching wallet balance:", error);
    }
  };

  const fetchSubscriptions = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from("subscriptions")
        .select(`
          *,
          product:product_id (id, name, price, description)
        `)
        .eq("customer_id", session.user.id)
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
        .order("price", { ascending: true });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  const handleCancelSubscription = async (id: string) => {
    try {
      const { error } = await supabase
        .from("subscriptions")
        .update({ status: "cancelled" })
        .eq("id", id);

      if (error) throw error;

      setSubscriptions(subscriptions.map(sub => 
        sub.id === id ? { ...sub, status: "cancelled" } : sub
      ));

      toast({
        title: "Subscription Cancelled",
        description: "Your subscription has been successfully cancelled.",
      });
    } catch (error) {
      console.error("Error cancelling subscription:", error);
      toast({
        title: "Error",
        description: "Failed to cancel subscription. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCreateSubscription = async () => {
    try {
      setIsCreating(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Error",
          description: "You must be logged in to create a subscription.",
          variant: "destructive",
        });
        return;
      }

      // Find the selected product to get its price
      const selectedProduct = products.find(p => p.id === newSubscription.productId);
      if (!selectedProduct) {
        toast({
          title: "Error",
          description: "Please select a valid product.",
          variant: "destructive",
        });
        return;
      }

      // Calculate the total cost
      const quantity = parseInt(newSubscription.quantity);
      const totalCost = selectedProduct.price * quantity;

      // Check if the user has enough balance
      if (walletBalance < totalCost) {
        toast({
          title: "Insufficient Balance",
          description: `You need ₹${totalCost.toFixed(2)} in your wallet. Current balance: ₹${walletBalance.toFixed(2)}`,
          variant: "destructive",
        });
        return;
      }

      // Calculate the next delivery date based on frequency
      let nextDelivery = new Date();
      nextDelivery.setHours(8, 0, 0, 0); // Set to 8:00 AM
      nextDelivery.setDate(nextDelivery.getDate() + 1); // Start from tomorrow

      // Create the subscription
      const { data: subscription, error: subscriptionError } = await supabase
        .from("subscriptions")
        .insert({
          customer_id: session.user.id,
          product_id: newSubscription.productId,
          quantity: quantity,
          frequency: newSubscription.frequency,
          next_delivery: nextDelivery.toISOString(),
          status: "active"
        })
        .select();

      if (subscriptionError) throw subscriptionError;

      // Deduct the money from the wallet
      const { error: transactionError } = await supabase
        .from("wallet_transactions")
        .insert({
          user_id: session.user.id,
          amount: totalCost,
          transaction_type: "subscription",
          status: "completed"
        });

      if (transactionError) throw transactionError;

      // Refresh data
      fetchSubscriptions();
      fetchWalletBalance();
      
      // Reset form and close dialog
      setNewSubscription({
        productId: "",
        quantity: "1",
        frequency: "daily"
      });
      setIsDialogOpen(false);

      toast({
        title: "Subscription Created",
        description: "Your subscription has been successfully created.",
      });
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

  const renderFrequencyText = (frequency: string) => {
    switch (frequency) {
      case "daily": return "Daily";
      case "alternate_days": return "Every 2 days";
      case "weekly": return "Weekly";
      case "monthly": return "Monthly";
      default: return frequency;
    }
  };

  // Format the product price to show rupees
  const formatPrice = (price: number) => {
    return `₹${price.toFixed(2)}`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Subscriptions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading subscriptions...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>My Subscriptions</CardTitle>
          <CardDescription>Manage your regular milk deliveries</CardDescription>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-[#437358] hover:bg-[#345c46]">
              <Plus className="h-4 w-4 mr-2" />
              New Subscription
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Subscribe to Regular Delivery</DialogTitle>
              <DialogDescription>
                Choose a milk product and delivery frequency for regular deliveries.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="product">Select Product</Label>
                <Select 
                  value={newSubscription.productId} 
                  onValueChange={(value) => setNewSubscription({...newSubscription, productId: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} - {formatPrice(product.price)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity (liters)</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={newSubscription.quantity}
                  onChange={(e) => setNewSubscription({...newSubscription, quantity: e.target.value})}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="frequency">Delivery Frequency</Label>
                <Select 
                  value={newSubscription.frequency} 
                  onValueChange={(value) => setNewSubscription({...newSubscription, frequency: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="alternate_days">Every 2 days</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="bg-gray-50 p-3 rounded-lg mt-4">
                <p className="text-sm font-medium">Wallet Balance: {formatPrice(walletBalance)}</p>
                {newSubscription.productId && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Subscription Cost: {formatPrice(
                      products.find(p => p.id === newSubscription.productId)?.price || 0 * 
                      parseInt(newSubscription.quantity || "0")
                    )}
                  </p>
                )}
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button 
                onClick={handleCreateSubscription} 
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
        {subscriptions.length === 0 ? (
          <Alert>
            <AlertTitle>No active subscriptions</AlertTitle>
            <AlertDescription>
              You don't have any active subscriptions yet. Subscribe to get regular deliveries.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            {subscriptions.map((subscription) => (
              <div 
                key={subscription.id} 
                className="border rounded-md p-4 relative"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-medium">{subscription.product.name}</h3>
                    <p className="text-sm text-muted-foreground">{formatPrice(subscription.product.price)} per unit</p>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      subscription.status === "active" 
                        ? "bg-green-100 text-green-800" 
                        : "bg-gray-100 text-gray-800"
                    }`}>
                      {subscription.status}
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-2 text-sm mt-2">
                  <div className="flex items-center">
                    <Milk className="h-4 w-4 mr-1" />
                    <span>Qty: {subscription.quantity}</span>
                  </div>
                  <div className="flex items-center">
                    <ArrowUpDown className="h-4 w-4 mr-1" />
                    <span>{renderFrequencyText(subscription.frequency)}</span>
                  </div>
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-1" />
                    <span>Next: {subscription.next_delivery 
                      ? new Date(subscription.next_delivery).toLocaleDateString() 
                      : "Not scheduled"}
                    </span>
                  </div>
                </div>
                
                {subscription.status === "active" && (
                  <div className="mt-3">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleCancelSubscription(subscription.id)}
                    >
                      Cancel Subscription
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
