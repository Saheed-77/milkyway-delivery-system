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
import { StockReservation } from "@/types/milk";

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

      // Using a safer approach to check for stock reservations
      let reservationData: StockReservation[] | null = null;
      
      try {
        // Try using a generic query that's safe even if the table doesn't exist yet
        const result = await supabase
          .rpc('check_stock_availability', { requested_quantity: 0 });
          
        // Now try to get the reservations - this is a direct query approach
        const { data, error } = await supabase.rpc('get_stock_reservations');
        
        if (!error && data) {
          reservationData = data as StockReservation[];
        } else {
          console.log("Using fallback method to get reservations");
          // Direct query approach might fail if table doesn't exist or RPC isn't created
          // Use direct SQL query via function instead
          const { data: rawData, error: rawError } = await supabase
            .from('stock_reservations')
            .select('*')
            .order('reservation_date', { ascending: false })
            .limit(1) as { data: StockReservation[] | null, error: any };
            
          if (!rawError) {
            reservationData = rawData;
          }
        }
      } catch (err) {
        console.log("Error fetching reservations:", err);
        // Table might not exist yet, we'll handle this below
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
      
      // Get the last reservation date and amount
      let lastReservation = null;
      let currentReserved = 0;
      
      if (reservationData && reservationData.length > 0) {
        const reservation = reservationData[0];
        lastReservation = reservation.reservation_date;
        currentReserved = reservation.reserved_amount;
      }
      
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
      
      try {
        // Try to insert a reservation - use SQL instead of relying on types
        const { error: insertError } = await supabase
          .rpc('create_stock_reservation', { 
            res_date: tomorrow,
            res_amount: subscriptionDemand,
            res_type: "subscription" 
          });
          
        if (insertError) {
          // Fallback to direct insert as any
          const { error: fallbackError } = await supabase
            .from('stock_reservations')
            .insert({
              reservation_date: tomorrow,
              reserved_amount: subscriptionDemand,
              reservation_type: "subscription"
            } as any);
            
          if (fallbackError) throw fallbackError;
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
          description: "Failed to reserve stock. The stock_reservations table might need to be created first.",
          variant: "destructive"
        });
      }
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
