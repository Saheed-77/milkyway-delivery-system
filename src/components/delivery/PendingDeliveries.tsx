
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
import { Package, Truck, MapPin, CheckCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const PendingDeliveries = () => {
  const [pendingDeliveries, setPendingDeliveries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchPendingDeliveries();
  }, []);

  const fetchPendingDeliveries = async () => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("Not authenticated");
      }

      // Fetch pending orders with their items and product details
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id,
          created_at,
          total_amount,
          status,
          delivery_slot,
          customer_id,
          order_items (
            id,
            quantity,
            unit_price,
            product_id,
            product:products (
              name,
              milk_type
            )
          ),
          customer:profiles (
            first_name,
            last_name,
            email
          )
        `)
        .eq("status", "pending");

      if (error) {
        throw error;
      }

      setPendingDeliveries(data || []);
    } catch (error) {
      console.error("Error fetching pending deliveries:", error);
      toast({
        title: "Error",
        description: "Failed to load pending deliveries",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkAsDelivered = async (orderId) => {
    try {
      setIsUpdating(true);
      
      // Update the status to "completed" instead of "delivered"
      // This is to comply with the database check constraint
      const { error } = await supabase
        .from("orders")
        .update({ status: "completed" })
        .eq("id", orderId);

      if (error) {
        console.error("Error updating order status:", error);
        throw error;
      }

      // After successful update, refresh the data
      await fetchPendingDeliveries();

      toast({
        title: "Success",
        description: "Order marked as delivered",
      });
    } catch (error) {
      console.error("Error updating order status:", error);
      toast({
        title: "Error",
        description: "Failed to update order status",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return `${date.toLocaleDateString()} (${formatDistanceToNow(date, { addSuffix: true })})`;
    } catch (error) {
      return dateString;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5 text-[#437358]" />
          Pending Deliveries
        </CardTitle>
        <CardDescription>Orders waiting to be delivered</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-center py-8 text-muted-foreground">Loading deliveries...</p>
        ) : pendingDeliveries.length === 0 ? (
          <div className="text-center py-8">
            <Truck className="h-12 w-12 mx-auto text-muted-foreground opacity-20" />
            <p className="mt-2 text-muted-foreground">No pending deliveries</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Order Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingDeliveries.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">
                      {order.id.substring(0, 8)}...
                    </TableCell>
                    <TableCell>
                      {order.customer?.first_name} {order.customer?.last_name}
                    </TableCell>
                    <TableCell>
                      {order.order_items.map((item, index) => (
                        <div key={item.id} className={index > 0 ? "mt-1" : ""}>
                          {item.quantity} × {item.product?.name || `${item.product?.milk_type || "Unknown"} Milk`}
                        </div>
                      ))}
                    </TableCell>
                    <TableCell>
                      {formatDate(order.created_at)}
                    </TableCell>
                    <TableCell>
                      ₹{order.total_amount.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="flex items-center gap-1 text-green-600 border-green-600 hover:bg-green-50"
                        onClick={() => handleMarkAsDelivered(order.id)}
                        disabled={isUpdating}
                      >
                        <CheckCircle className="h-4 w-4" />
                        <span>{isUpdating ? "Updating..." : "Delivered"}</span>
                      </Button>
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
