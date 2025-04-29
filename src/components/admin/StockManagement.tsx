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
import { Milk, CalendarDays, AlertTriangle, CheckCircle } from "lucide-react";
import { format } from "date-fns";

interface StockSummary {
  total_stock: number;
  available_stock: number;
  subscription_demand: number;
  leftover_from_yesterday: number;
}

export const StockManagement = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [stockSummary, setStockSummary] = useState<StockSummary | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchStockSummary();
  }, []);

  const fetchStockSummary = async () => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .rpc('get_today_stock_summary')
        .single();
        
      if (error) throw error;
      
      setStockSummary(data);
    } catch (error) {
      console.error("Error fetching stock summary:", error);
      toast({
        title: "Error",
        description: "Failed to load stock information",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDailyReset = async () => {
    try {
      const { error } = await supabase
        .rpc('archive_and_reset_daily_stock');
        
      if (error) throw error;
      
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Milk className="mr-2 h-5 w-5 text-[#437358]" />
          Daily Stock Management
        </CardTitle>
        <CardDescription>
          Track and manage daily milk stock
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Loading stock information...</p>
        ) : stockSummary ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-white">
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{stockSummary.total_stock}L</div>
                  <p className="text-muted-foreground text-sm">Total Stock</p>
                </CardContent>
              </Card>
              
              <Card className={`${stockSummary.available_stock < stockSummary.subscription_demand ? 'bg-red-50' : 'bg-green-50'}`}>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{stockSummary.available_stock}L</div>
                  <p className="text-muted-foreground text-sm">Available Stock</p>
                  {stockSummary.available_stock < stockSummary.subscription_demand && (
                    <div className="flex items-center text-red-500 text-xs mt-2">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      <span>Low stock alert</span>
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
            
            <div className="flex justify-end">
              <Button
                onClick={handleDailyReset}
                className="bg-[#437358] hover:bg-[#345c46]"
              >
                Archive and Reset Daily Stock
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground">No stock information available</p>
        )}
      </CardContent>
    </Card>
  );
}; 