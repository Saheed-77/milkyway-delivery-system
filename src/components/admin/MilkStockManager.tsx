
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Milk, CalendarDays, AlertTriangle, CheckCircle } from "lucide-react";
import { format, addDays } from "date-fns";

export const MilkStockManager = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [milkStock, setMilkStock] = useState(0);
  const [reservedStock, setReservedStock] = useState(0);
  const [availableStock, setAvailableStock] = useState(0);
  const [subscriptionDemand, setSubscriptionDemand] = useState(0);
  const [processingReservation, setProcessingReservation] = useState(false);
  const [lastReservationDate, setLastReservationDate] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchMilkStockData();
  }, []);

  const fetchMilkStockData = async () => {
    try {
      setIsLoading(true);
      
      // Fetch current milk stock
      const { data: stockData, error: stockError } = await supabase
        .from("milk_stock")
        .select("total_stock")
        .single();
      
      if (stockError) throw stockError;
      
      // Get the reservation data
      const { data: reservationData, error: reservationError } = await supabase
        .from("stock_reservations")
        .select("*")
        .order("reservation_date", { ascending: false })
        .limit(1);
        
      if (reservationError) {
        // Table might not exist yet, we'll create it when needed
        console.log("Stock reservations table might not exist yet");
      }
      
      // Calculate daily subscription demand
      const { data: subscriptionData, error: subscriptionError } = await supabase
        .from("subscriptions")
        .select(`
          quantity,
          frequency,
          product:products (milk_type)
        `)
        .eq("status", "active");
        
      if (subscriptionError) throw subscriptionError;
      
      // Calculate daily demand from subscriptions
      let dailyDemand = 0;
      
      subscriptionData?.forEach(subscription => {
        const quantity = subscription.quantity || 0;
        
        // Convert different frequencies to daily equivalent
        switch(subscription.frequency) {
          case 'daily':
            dailyDemand += quantity;
            break;
          case 'weekly':
            dailyDemand += quantity / 7;
            break;
          case 'monthly':
            dailyDemand += quantity / 30;
            break;
        }
      });
      
      // Get the last reservation date
      const lastReservation = reservationData?.[0]?.reservation_date || null;
      
      // Calculate currently reserved stock
      const currentReserved = reservationData?.[0]?.reserved_amount || 0;
      
      // Calculate available stock
      const available = (stockData?.total_stock || 0) - currentReserved;
      
      setMilkStock(stockData?.total_stock || 0);
      setReservedStock(currentReserved);
      setAvailableStock(available);
      setSubscriptionDemand(Math.ceil(dailyDemand));
      setLastReservationDate(lastReservation);
      
    } catch (error) {
      console.error("Error fetching milk stock data:", error);
      toast({
        title: "Error",
        description: "Failed to load milk stock data",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const reserveStockForSubscriptions = async () => {
    try {
      setProcessingReservation(true);
      
      // Make sure we have enough stock
      if (subscriptionDemand > milkStock) {
        toast({
          title: "Warning",
          description: "Not enough milk stock to fulfill subscription demand",
          variant: "destructive"
        });
        return;
      }
      
      // Create a new reservation for tomorrow
      const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
      
      // Check if the stock_reservations table exists, if not create it
      const { error: insertError } = await supabase
        .from("stock_reservations")
        .insert({
          reservation_date: tomorrow,
          reserved_amount: subscriptionDemand,
          reservation_type: "subscription"
        });
        
      if (insertError) {
        // Table might not exist yet
        if (insertError.message.includes("relation") && insertError.message.includes("does not exist")) {
          console.log("Creating stock_reservations table...");
          // We'll let the user know they need to create the table
          throw new Error("Stock reservations table needs to be created first. Please ask Lovable to create it.");
        } else {
          throw insertError;
        }
      }
      
      toast({
        title: "Success",
        description: `Reserved ${subscriptionDemand}L for subscriptions on ${tomorrow}`,
      });
      
      // Refresh the data
      fetchMilkStockData();
      
    } catch (error) {
      console.error("Error reserving stock:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to reserve stock",
        variant: "destructive"
      });
    } finally {
      setProcessingReservation(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Milk className="mr-2 h-5 w-5 text-[#437358]" />
          Milk Stock Management
        </CardTitle>
        <CardDescription>
          Track and reserve milk for daily operations
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Loading stock information...</p>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-white">
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{milkStock}L</div>
                  <p className="text-muted-foreground text-sm">Total Milk Stock</p>
                </CardContent>
              </Card>
              
              <Card className={`${availableStock < subscriptionDemand ? 'bg-red-50' : 'bg-green-50'}`}>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{availableStock}L</div>
                  <p className="text-muted-foreground text-sm">Available Stock</p>
                  {availableStock < subscriptionDemand && (
                    <div className="flex items-center text-red-500 text-xs mt-2">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      <span>Low stock alert</span>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              <Card className="bg-blue-50">
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{subscriptionDemand}L</div>
                  <p className="text-muted-foreground text-sm">Daily Subscription Demand</p>
                </CardContent>
              </Card>
            </div>
            
            <Card>
              <CardHeader className="pb-2">
                <h3 className="text-sm font-medium">Subscription Reservations</h3>
              </CardHeader>
              <CardContent>
                <div className="text-sm">
                  {lastReservationDate ? (
                    <div className="flex items-center space-x-2">
                      <CalendarDays className="h-4 w-4 text-blue-600" />
                      <span>Last reservation: {lastReservationDate}</span>
                      <span className="text-muted-foreground">({reservedStock}L reserved)</span>
                    </div>
                  ) : (
                    <div className="text-amber-600 flex items-center">
                      <AlertTriangle className="h-4 w-4 mr-1" />
                      <span>No recent reservations found</span>
                    </div>
                  )}
                </div>
                
                <div className="mt-4">
                  <Button
                    onClick={reserveStockForSubscriptions}
                    disabled={processingReservation || subscriptionDemand <= 0}
                    className="bg-[#437358] hover:bg-[#345c46] w-full"
                  >
                    {processingReservation ? "Processing..." : `Reserve ${subscriptionDemand}L for Tomorrow's Subscriptions`}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
