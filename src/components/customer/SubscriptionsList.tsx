
import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Milk, ArrowUpDown } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

export const SubscriptionsList = () => {
  const [subscriptions, setSubscriptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchSubscriptions = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data, error } = await supabase
          .from("subscriptions")
          .select(`
            *,
            product:product_id (name, price, description)
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

    fetchSubscriptions();
  }, [toast]);

  const handleCancelSubscription = async (id) => {
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
      <CardHeader>
        <CardTitle>My Subscriptions</CardTitle>
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
                    <p className="text-sm text-muted-foreground">${subscription.product.price.toFixed(2)} per unit</p>
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
                    <span>{subscription.frequency}</span>
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
