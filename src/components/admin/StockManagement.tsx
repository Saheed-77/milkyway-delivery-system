import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  getTodayStockSummary,
  getLatestMilkStock,
  archiveAndResetDailyStock,
  archiveMilkInventory,
} from "@/lib/rpc";
import { useToast } from "@/components/ui/use-toast";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Milk, CalendarDays, AlertTriangle, CheckCircle, ShoppingCart, ArchiveIcon } from "lucide-react";
import { format } from "date-fns";

interface StockSummary {
  total_stock: number;
  available_stock: number;
  subscription_demand: number;
  leftover_from_yesterday: number;
  sold_stock: number;
}

// Define the milk_stock table interface to match DB schema
interface MilkStockRecord {
  total_stock: number;
  available_stock: number;
  subscription_demand: number;
  leftover_milk: number;
  date: string;
}

export const StockManagement = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [stockSummary, setStockSummary] = useState<StockSummary>({
    total_stock: 0,
    available_stock: 0,
    subscription_demand: 0,
    leftover_from_yesterday: 0,
    sold_stock: 0
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchStockSummary();

    // Set up real-time subscription for milk_stock changes
    const stockSubscription = supabase
      .channel('stock-changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'milk_stock' 
      }, (payload) => {
        console.log("Milk stock table changed, refreshing data...", payload);
        fetchStockSummary();
      })
      .subscribe();

    // Set up real-time subscription for milk_contributions
    const contributionsSubscription = supabase
      .channel('contributions-changes')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'milk_contributions' 
      }, (payload) => {
        console.log("New milk contribution detected, refreshing stock data...", payload);
        fetchStockSummary();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(stockSubscription);
      supabase.removeChannel(contributionsSubscription);
    };
  }, []);

  const fetchStockSummary = async () => {
    try {
      setIsLoading(true);
      
      const summary = await getTodayStockSummary();

      if (summary) {
        setStockSummary({
          total_stock: summary.total_stock || 0,
          available_stock: summary.available_stock || 0,
          subscription_demand: summary.subscription_demand || 0,
          leftover_from_yesterday: summary.leftover_from_yesterday || 0,
          sold_stock: summary.sold_stock || 0
        });
      } else {
        // If no summary data, get the latest milk stock
        const latest = await getLatestMilkStock();
        setStockSummary({
          total_stock: latest?.total_stock || 0,
          available_stock: latest?.available_stock || 0,
          subscription_demand: latest?.subscription_demand || 0,
          leftover_from_yesterday: 0,
          sold_stock: 0
        });
      }
    } catch (error) {
      console.error("Error fetching stock summary:", error);
      toast({
        title: "Error",
        description: "Failed to load stock information",
        variant: "destructive"
      });
      // On error, reset to zeros
      setStockSummary({
        total_stock: 0,
        available_stock: 0,
        subscription_demand: 0,
        leftover_from_yesterday: 0,
        sold_stock: 0
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDailyReset = async () => {
    try {
      await archiveAndResetDailyStock();

      toast({
        title: "Success",
        description: "Daily stock has been archived and reset",
      });
      
      fetchStockSummary();
    } catch (error) {
      console.error("Error resetting daily stock:", error);
      toast({
        title: "Error",
        description: "Failed to reset daily stock",
        variant: "destructive"
      });
    }
  };
  
  const handleArchiveInventory = async () => {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      const archived = await archiveMilkInventory(yesterdayStr);

      if (archived) {
        toast({
          title: "Success",
          description: "Inventory data has been archived successfully",
        });
      } else {
        toast({
          title: "Information",
          description: "No inventory data to archive or already archived",
        });
      }
    } catch (error) {
      console.error("Error archiving inventory:", error);
      toast({
        title: "Error",
        description: "Failed to archive inventory data",
        variant: "destructive"
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="flex items-center">
              <Milk className="mr-2 h-5 w-5 text-[#437358]" />
              Daily Stock Management
            </CardTitle>
            <CardDescription>
              Track and manage daily milk stock
            </CardDescription>
          </div>
          <div className="text-xs text-muted-foreground">
            Auto-resets at midnight daily
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Loading stock information...</p>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              <Card className="bg-white">
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{stockSummary.total_stock}L</div>
                  <p className="text-muted-foreground text-sm">Current Stock</p>
                </CardContent>
              </Card>
              
              <Card className="bg-amber-50">
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{stockSummary.sold_stock}L</div>
                  <p className="text-muted-foreground text-sm">Sold Today</p>
                  <div className="flex items-center text-xs text-muted-foreground mt-1">
                    <ShoppingCart className="w-3 h-3 mr-1" />
                    <span>Orders & Subscriptions</span>
                  </div>
                </CardContent>
              </Card>
              
              <Card className={`${stockSummary.available_stock < stockSummary.subscription_demand ? 'bg-red-50' : 'bg-green-50'}`}>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{stockSummary.available_stock}L</div>
                  <p className="text-muted-foreground text-sm">Available Stock</p>
                  {stockSummary.available_stock < stockSummary.subscription_demand && (
                    <div className="flex items-center text-red-500 text-xs mt-1">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      <span>Low stock</span>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              <Card className="bg-blue-50">
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{stockSummary.subscription_demand}L</div>
                  <p className="text-muted-foreground text-sm">Subscription Demand</p>
                </CardContent>
              </Card>

              <Card className="bg-yellow-50">
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{stockSummary.leftover_from_yesterday}L</div>
                  <p className="text-muted-foreground text-sm">Leftover from Yesterday</p>
                </CardContent>
              </Card>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button
                onClick={handleArchiveInventory}
                variant="outline"
                className="border-[#437358] text-[#437358]"
              >
                <ArchiveIcon className="h-4 w-4 mr-2" />
                Archive Inventory
              </Button>
              <Button
                onClick={handleDailyReset}
                className="bg-[#437358] hover:bg-[#345c46]"
              >
                Reset Daily Stock
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}; 