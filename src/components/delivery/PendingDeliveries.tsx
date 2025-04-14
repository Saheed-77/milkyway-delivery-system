
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
import { Package, Truck, MapPin, CreditCard, CheckCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const PendingDeliveries = ({ onStatusChange }) => {
  const [pendingDeliveries, setPendingDeliveries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
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

      // Fetch orders with customer data
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id,
          created_at,
          total_amount,
          status,
          delivery_slot,
          payment_method,
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
            id,
            first_name,
            last_name,
            email
          )
        `)
        .eq("status", "pending");

      if (error) {
        throw error;
      }

      // Process orders
      const orders = data || [];
      
      // Since we don't have a customer_addresses table in the schema, we'll modify our approach
      // and just use the available information from profiles
      
      // Add customer_address property for each order 
      // (in a real app, you would fetch this from a proper addresses table)
      const ordersWithAddresses = orders.map(order => {
        return {
          ...order,
          customer_address: {
            address_line1: "Default delivery address",
            city: order.customer?.first_name ? `${order.customer.first_name}'s City` : "City",
            state: "State",
            postal_code: "000000"
          }
        };
      });

      setPendingDeliveries(ordersWithAddresses);
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
      setUpdatingOrderId(orderId);
      
      const { error } = await supabase
        .from("orders")
        .update({ status: "completed" })
        .eq("id", orderId);

      if (error) {
        console.error("Error updating order status:", error);
        throw error;
      }

      await fetchPendingDeliveries();
      
      if (onStatusChange) {
        onStatusChange();
      }

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
      setUpdatingOrderId(null);
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

  const formatAddress = (address) => {
    if (!address) {
      return "Address not available";
    }
    
    const parts = [];
    if (address.address_line1) parts.push(address.address_line1);
    if (address.city) parts.push(address.city);
    if (address.state) parts.push(address.state);
    if (address.postal_code) parts.push(address.postal_code);
    
    return parts.join(", ");
  };

  const formatPaymentMethod = (method) => {
    switch(method) {
      case "cod":
        return "Cash on Delivery";
      case "wallet":
        return "Wallet";
      case "online":
        return "Online Payment";
      default:
        return method;
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
                  <TableHead>Address</TableHead>
                  <TableHead>Payment</TableHead>
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
                    <TableCell className="max-w-[200px]">
                      <div className="flex items-start gap-1">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <span className="text-sm break-words">
                          {formatAddress(order.customer_address)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        <span>{formatPaymentMethod(order.payment_method)}</span>
                      </div>
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
                        <span>{isUpdating && updatingOrderId === order.id ? "Updating..." : "Delivered"}</span>
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
