
import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import { 
  Table, 
  TableHeader, 
  TableRow, 
  TableHead, 
  TableBody, 
  TableCell 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, MapPin } from "lucide-react";
import { format, isToday, isTomorrow, addDays } from "date-fns";

export const DeliverySchedule = () => {
  const [scheduledDeliveries, setScheduledDeliveries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchScheduledDeliveries();
  }, []);

  const fetchScheduledDeliveries = async () => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("Not authenticated");
      }

      // Fetch pending orders with scheduled delivery slots
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id,
          created_at,
          total_amount,
          status,
          delivery_slot,
          customer_id,
          customer:profiles (
            first_name,
            last_name,
            email
          )
        `)
        .eq("status", "pending")
        .not("delivery_slot", "is", null)
        .order('delivery_slot', { ascending: true });

      if (error) {
        throw error;
      }

      setScheduledDeliveries(data || []);
    } catch (error) {
      console.error("Error fetching scheduled deliveries:", error);
      toast({
        title: "Error",
        description: "Failed to load delivery schedule",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      
      if (isToday(date)) {
        return `Today at ${format(date, 'h:mm a')}`;
      } else if (isTomorrow(date)) {
        return `Tomorrow at ${format(date, 'h:mm a')}`;
      } else {
        return format(date, 'MMM d, yyyy h:mm a');
      }
    } catch (error) {
      return dateString;
    }
  };

  const getDeliveryDateLabel = (dateString) => {
    try {
      const date = new Date(dateString);
      
      if (isToday(date)) {
        return <Badge className="bg-green-100 text-green-800 border-green-200">Today</Badge>;
      } else if (isTomorrow(date)) {
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Tomorrow</Badge>;
      } else if (date < addDays(new Date(), 7)) {
        return <Badge className="bg-purple-100 text-purple-800 border-purple-200">This Week</Badge>;
      } else {
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200">Upcoming</Badge>;
      }
    } catch (error) {
      return <Badge>Unknown</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-[#437358]" />
          Delivery Schedule
        </CardTitle>
        <CardDescription>Upcoming scheduled deliveries</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-center py-8 text-muted-foreground">Loading schedule...</p>
        ) : scheduledDeliveries.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="h-12 w-12 mx-auto text-muted-foreground opacity-20" />
            <p className="mt-2 text-muted-foreground">No scheduled deliveries</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Scheduled For</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scheduledDeliveries.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">
                      {order.id.substring(0, 8)}...
                    </TableCell>
                    <TableCell>
                      {order.customer?.first_name} {order.customer?.last_name}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-500" />
                        {formatDate(order.delivery_slot)}
                      </div>
                    </TableCell>
                    <TableCell>
                      ₹{order.total_amount.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {getDeliveryDateLabel(order.delivery_slot)}
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
