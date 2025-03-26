import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Repeat, Plus } from "lucide-react";
import { format } from "date-fns";

export const SubscriptionsList = () => {
  const [subscriptions, setSubscriptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchSubscriptions();
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
        <Button variant="outline" size="sm" className="flex items-center gap-1">
          <Plus className="h-4 w-4" />
          <span>New</span>
        </Button>
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
