
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
import { CheckCircle, Package } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const CompletedDeliveries = () => {
  const [completedDeliveries, setCompletedDeliveries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchCompletedDeliveries();
  }, []);

  const fetchCompletedDeliveries = async () => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("Not authenticated");
      }

      // Fetch completed orders with their items and product details
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id,
          created_at,
          updated_at,
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
        .eq("status", "completed")
        .order('updated_at', { ascending: false });

      if (error) {
        throw error;
      }

      setCompletedDeliveries(data || []);
    } catch (error) {
      console.error("Error fetching completed deliveries:", error);
      toast({
        title: "Error",
        description: "Failed to load completed deliveries",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
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
          <CheckCircle className="h-5 w-5 text-green-600" />
          Completed Deliveries
        </CardTitle>
        <CardDescription>Orders that have been successfully delivered</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-center py-8 text-muted-foreground">Loading deliveries...</p>
        ) : completedDeliveries.length === 0 ? (
          <div className="text-center py-8">
            <Package className="h-12 w-12 mx-auto text-muted-foreground opacity-20" />
            <p className="mt-2 text-muted-foreground">No completed deliveries</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Delivered On</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {completedDeliveries.map((order) => (
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
                      {formatDate(order.updated_at)}
                    </TableCell>
                    <TableCell>
                      ₹{order.total_amount.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200">
                        Completed
                      </Badge>
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
