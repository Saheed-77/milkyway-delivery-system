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
import { Milk, Calendar } from "lucide-react";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const MilkCollectionsList = () => {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    from: null,
    to: null,
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchCollections();
  }, [dateRange]);

  const fetchCollections = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("milk_contributions")
        .select(`
          *,
          farmer:profiles!farmer_id (
            email,
            first_name,
            last_name,
            status
          )
        `)
        .order("contribution_date", { ascending: false });

      // Add date range filter if dates are selected
      if (dateRange.from) {
        query = query.gte("contribution_date", dateRange.from.toISOString().split('T')[0]);
      }
      if (dateRange.to) {
        query = query.lte("contribution_date", dateRange.to.toISOString().split('T')[0]);
      }

      const { data, error } = await query;

      if (error) throw error;
      setCollections(data || []);
    } catch (error) {
      console.error("Error fetching collections:", error);
      toast({
        title: "Error",
        description: "Failed to load milk collections.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getQualityLabel = (rating) => {
    switch (rating) {
      case 1: return "A (Excellent)";
      case 2: return "B (Good)";
      case 3: return "C (Below Standard)";
      default: return "Not rated";
    }
  };

  const getFarmerStatus = (farmer) => {
    if (!farmer) return "Unknown";
    
    if (farmer.status === "rejected") {
      return <span className="text-red-600 font-medium">Blacklisted</span>;
    }
    return farmer.status || "Active";
  };

  const clearDateFilter = () => {
    setDateRange({ from: null, to: null });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <Milk className="h-5 w-5 mr-2 text-[#437358]" />
            Milk Collections
          </CardTitle>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[240px] justify-start text-left font-normal",
                    !dateRange.from && "text-muted-foreground"
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {dateRange.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd, y")} -{" "}
                        {format(dateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <CalendarUI
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
            {(dateRange.from || dateRange.to) && (
              <Button variant="outline" onClick={clearDateFilter}>
                Clear
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-center py-4">Loading milk collections...</p>
        ) : collections.length === 0 ? (
          <p className="text-center py-4 text-muted-foreground">No milk collections found</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Farmer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Milk Type</TableHead>
                  <TableHead>Quantity (L)</TableHead>
                  <TableHead>Quality Rating</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {collections.map((collection) => (
                  <TableRow 
                    key={collection.id}
                    className={collection.quality_rating === 3 ? "bg-red-50" : ""}
                  >
                    <TableCell>
                      {format(new Date(collection.contribution_date), "MMM dd, yyyy")}
                    </TableCell>
                    <TableCell>
                      {collection.farmer?.first_name 
                        ? `${collection.farmer.first_name} ${collection.farmer.last_name}`
                        : collection.farmer?.email || "Unknown"}
                    </TableCell>
                    <TableCell>
                      {getFarmerStatus(collection.farmer)}
                    </TableCell>
                    <TableCell className="capitalize">{collection.milk_type}</TableCell>
                    <TableCell>
                      {collection.quantity === 0 ? (
                        <span className="text-red-600">Rejected</span>
                      ) : (
                        collection.quantity
                      )}
                    </TableCell>
                    <TableCell>
                      {collection.quality_rating 
                        ? getQualityLabel(collection.quality_rating)
                        : "Not rated"}
                    </TableCell>
                    <TableCell className="text-right">
                      ₹{collection.price?.toFixed(2) || '0.00'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
