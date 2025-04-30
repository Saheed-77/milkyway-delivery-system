import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Package, Calendar, BarChart } from "lucide-react";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface StockArchive {
  id: number;
  date: string;
  total_stock: number;
  available_stock: number;
  subscription_demand: number;
  leftover_milk: number;
  created_at: string;
}

interface TodayStockSummary {
  total_stock: number;
  available_stock: number;
  subscription_demand: number;
  leftover_from_yesterday: number;
  sold_stock: number;
}

interface InventorySummary {
  start_date: string;
  end_date: string;
  avg_total_stock: number;
  avg_subscription_demand: number;
  avg_leftover_milk: number;
  max_total_stock: number;
  min_total_stock: number;
  total_days: number;
}

export const InventoryManagement = () => {
  const [stockHistory, setStockHistory] = useState<StockArchive[]>([]);
  const [todayStock, setTodayStock] = useState<TodayStockSummary>({
    total_stock: 0,
    available_stock: 0,
    subscription_demand: 0,
    leftover_from_yesterday: 0,
    sold_stock: 0
  });
  const [inventorySummary, setInventorySummary] = useState<InventorySummary>({
    start_date: new Date().toISOString(),
    end_date: new Date().toISOString(),
    avg_total_stock: 0,
    avg_subscription_demand: 0,
    avg_leftover_milk: 0,
    max_total_stock: 0,
    min_total_stock: 0,
    total_days: 0
  });
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const { toast } = useToast();

  useEffect(() => {
    fetchStockHistory();
    fetchTodayStockSummary();
    fetchInventorySummary();

    // Set up real-time subscription for milk_stock changes
    const stockSubscription = supabase
      .channel('milk-stock-changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'milk_stock' 
      }, () => {
        console.log("Milk stock table changed, refreshing data...");
        fetchTodayStockSummary();
      })
      .subscribe();
      
    // Set up real-time subscription for milk_inventory_archive changes
    const archiveSubscription = supabase
      .channel('inventory-archive-changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'milk_inventory_archive' 
      }, () => {
        console.log("Inventory archive changed, refreshing data...");
        fetchStockHistory();
        fetchInventorySummary();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(stockSubscription);
      supabase.removeChannel(archiveSubscription);
    };
  }, [dateRange]);

  const fetchTodayStockSummary = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_today_stock_summary');

      if (error) throw error;
      if (data && Array.isArray(data) && data.length > 0) {
        setTodayStock({
          total_stock: data[0].total_stock || 0,
          available_stock: data[0].available_stock || 0,
          subscription_demand: data[0].subscription_demand || 0,
          leftover_from_yesterday: data[0].leftover_from_yesterday || 0,
          sold_stock: data[0].sold_stock || 0
        });
      } else {
        // Set default values if no data
        setTodayStock({
          total_stock: 0,
          available_stock: 0,
          subscription_demand: 0,
          leftover_from_yesterday: 0,
          sold_stock: 0
        });
      }
    } catch (error) {
      console.error("Error fetching today's stock summary:", error);
      toast({
        title: "Error",
        description: "Failed to load today's stock data.",
        variant: "destructive",
      });
      // Reset to defaults on error
      setTodayStock({
        total_stock: 0,
        available_stock: 0,
        subscription_demand: 0,
        leftover_from_yesterday: 0,
        sold_stock: 0
      });
    }
  };

  const fetchStockHistory = async () => {
    try {
      setLoading(true);
      
      // Use the new RPC function instead of direct table access
      let query = supabase.rpc('get_milk_inventory_archive');

      // Add date range filter if dates are selected
      if (dateRange && dateRange.from && dateRange.to) {
        query = supabase.rpc('get_milk_inventory_archive', { 
          start_date: dateRange.from.toISOString().split('T')[0],
          end_date: dateRange.to.toISOString().split('T')[0]
        });
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Transform the data to match our expected StockArchive type
      const formattedData = (data || []).map(item => ({
        id: item.id,
        date: item.date,
        total_stock: item.total_stock,
        available_stock: item.available_stock,
        subscription_demand: item.subscription_demand,
        leftover_milk: item.leftover_milk,
        created_at: item.created_at
      }));
      
      setStockHistory(formattedData);
    } catch (error) {
      console.error("Error fetching stock history:", error);
      toast({
        title: "Error",
        description: "Failed to load stock history.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchInventorySummary = async () => {
    try {
      const period = 30; // Default to 30 days
      
      // Use date range if provided
      if (dateRange && dateRange.from && dateRange.to) {
        const days = Math.round((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
        const { data, error } = await supabase.rpc('get_inventory_summary', { 
          period_days: days > 0 ? days : period 
        });
        
        if (error) throw error;
        if (data && data.length > 0 && data[0]) {
          setInventorySummary({
            start_date: data[0].start_date || new Date().toISOString(),
            end_date: data[0].end_date || new Date().toISOString(),
            avg_total_stock: data[0].avg_total_stock || 0,
            avg_subscription_demand: data[0].avg_subscription_demand || 0,
            avg_leftover_milk: data[0].avg_leftover_milk || 0,
            max_total_stock: data[0].max_total_stock || 0,
            min_total_stock: data[0].min_total_stock || 0,
            total_days: data[0].total_days || 0
          });
        }
      } else {
        const { data, error } = await supabase.rpc('get_inventory_summary', { 
          period_days: period 
        });
        
        if (error) throw error;
        if (data && data.length > 0 && data[0]) {
          setInventorySummary({
            start_date: data[0].start_date || new Date().toISOString(),
            end_date: data[0].end_date || new Date().toISOString(),
            avg_total_stock: data[0].avg_total_stock || 0,
            avg_subscription_demand: data[0].avg_subscription_demand || 0,
            avg_leftover_milk: data[0].avg_leftover_milk || 0,
            max_total_stock: data[0].max_total_stock || 0,
            min_total_stock: data[0].min_total_stock || 0,
            total_days: data[0].total_days || 0
          });
        }
      }
    } catch (error) {
      console.error("Error fetching inventory summary:", error);
      // Keep default values on error
    }
  };

  const clearDateFilter = () => {
    setDateRange(undefined);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <Package className="h-5 w-5 mr-2 text-[#437358]" />
            Inventory Management
          </CardTitle>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[240px] justify-start text-left font-normal",
                    !dateRange || !dateRange.from || !dateRange.to ? "text-muted-foreground" : ""
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {dateRange && dateRange.from && dateRange.to ? (
                    <>
                      {format(dateRange.from, "LLL dd, y")} -{" "}
                      {format(dateRange.to, "LLL dd, y")}
                    </>
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <CalendarUI
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={(range) => setDateRange(range)}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
            {dateRange && (dateRange.from || dateRange.to) && (
              <Button variant="outline" onClick={clearDateFilter}>
                Clear
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="today" className="mb-6">
          <TabsList>
            <TabsTrigger value="today">Today's Stock</TabsTrigger>
            <TabsTrigger value="history">Stock History</TabsTrigger>
            <TabsTrigger value="summary">Summary</TabsTrigger>
          </TabsList>
          
          <TabsContent value="today">
            {loading ? (
              <p className="text-center py-4">Loading today's stock information...</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-white">
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">{todayStock.total_stock}L</div>
                    <p className="text-muted-foreground text-sm">Current Stock</p>
                    <div className="text-xs text-muted-foreground mt-1">
                      Started with {todayStock.leftover_from_yesterday}L from yesterday
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-amber-50">
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">{todayStock.sold_stock}L</div>
                    <p className="text-muted-foreground text-sm">Sold Today</p>
                  </CardContent>
                </Card>
                
                <Card className={`${todayStock.available_stock < todayStock.subscription_demand ? 'bg-red-50' : 'bg-green-50'}`}>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">{todayStock.available_stock}L</div>
                    <p className="text-muted-foreground text-sm">Remaining Stock</p>
                    {todayStock.available_stock < todayStock.subscription_demand && (
                      <div className="text-xs text-red-500 mt-1">
                        Need {todayStock.subscription_demand - todayStock.available_stock}L more for subscriptions
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="history">
            {loading ? (
              <p className="text-center py-4">Loading stock history...</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Total Stock (L)</TableHead>
                      <TableHead>Available Stock (L)</TableHead>
                      <TableHead>Subscription Demand (L)</TableHead>
                      <TableHead>Leftover Milk (L)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stockHistory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          No stock history found
                        </TableCell>
                      </TableRow>
                    ) : (
                      stockHistory.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>
                            {format(new Date(record.date), "MMM dd, yyyy")}
                          </TableCell>
                          <TableCell>{record.total_stock}</TableCell>
                          <TableCell>{record.available_stock}</TableCell>
                          <TableCell>{record.subscription_demand}</TableCell>
                          <TableCell>{record.leftover_milk}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="summary">
            {loading ? (
              <p className="text-center py-4">Loading inventory summary...</p>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Card className="bg-white">
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">{inventorySummary.avg_total_stock}L</div>
                      <p className="text-muted-foreground text-sm">Average Daily Stock</p>
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>Min: {inventorySummary.min_total_stock}L</span>
                        <span>Max: {inventorySummary.max_total_stock}L</span>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-blue-50">
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">{inventorySummary.avg_subscription_demand}L</div>
                      <p className="text-muted-foreground text-sm">Average Daily Demand</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-green-50">
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">{inventorySummary.avg_leftover_milk}L</div>
                      <p className="text-muted-foreground text-sm">Average Daily Leftover</p>
                    </CardContent>
                  </Card>
                </div>
                
                <div className="bg-white p-4 rounded-md">
                  <h3 className="text-sm font-medium mb-2">Period Summary</h3>
                  <div className="flex flex-col md:flex-row gap-4 text-sm text-muted-foreground">
                    <div>
                      <span className="font-medium">Period: </span>
                      {format(new Date(inventorySummary.start_date), "MMM dd, yyyy")} - {format(new Date(inventorySummary.end_date), "MMM dd, yyyy")}
                    </div>
                    <div>
                      <span className="font-medium">Days analyzed: </span>
                      {inventorySummary.total_days}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}; 