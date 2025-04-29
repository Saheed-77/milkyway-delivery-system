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
import { Package, Calendar } from "lucide-react";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

interface StockArchive {
  id: string;
  date: string;
  total_stock: number;
  subscription_demand: number;
  leftover_stock: number;
  created_at: string;
  updated_at: string;
}

export const InventoryManagement = () => {
  const [stockHistory, setStockHistory] = useState<StockArchive[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const { toast } = useToast();

  useEffect(() => {
    fetchStockHistory();
  }, [dateRange]);

  const fetchStockHistory = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("milk_stock_archive")
        .select("*")
        .order("date", { ascending: false });

      // Add date range filter if dates are selected
      if (dateRange && dateRange.from) {
        query = query.gte("date", dateRange.from.toISOString().split('T')[0]);
      }
      if (dateRange && dateRange.to) {
        query = query.lte("date", dateRange.to.toISOString().split('T')[0]);
      }

      const { data, error } = await query;

      if (error) throw error;
      setStockHistory(data || []);
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
        {loading ? (
          <p className="text-center py-4">Loading stock history...</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Total Stock (L)</TableHead>
                  <TableHead>Sold Stock (L)</TableHead>
                  <TableHead>Leftover Stock (L)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockHistory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
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
                      <TableCell>{record.subscription_demand}</TableCell>
                      <TableCell>{record.leftover_stock}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}; 