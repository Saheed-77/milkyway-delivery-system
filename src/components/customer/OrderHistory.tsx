
import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
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
import { Package, Clock, CheckCircle, XCircle, CreditCard, Banknote } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const OrderHistory = ({ refreshTrigger = 0 }) => {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchOrders();
  }, [refreshTrigger]); // Re-fetch when refreshTrigger changes

  const fetchOrders = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          order_items (
            *,
            product:product_id (name, milk_type)
          )
        `)
        .eq("customer_id", session.user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error("Error fetching orders:", error);
      toast({
        title: "Error",
        description: "Failed to load your order history. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
          <Clock className="h-3 w-3 mr-1" /> Pending
        </Badge>;
      case "completed":
        return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
          <CheckCircle className="h-3 w-3 mr-1" /> Delivered
        </Badge>;
      case "cancelled":
        return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">
          <XCircle className="h-3 w-3 mr-1" /> Cancelled
        </Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPaymentMethodBadge = (method) => {
    if (method === "cod") {
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
        <Banknote className="h-3 w-3 mr-1" /> Cash on Delivery
      </Badge>;
    }
    return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
      <CreditCard className="h-3 w-3 mr-1" /> Wallet
    </Badge>;
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
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>
          <div className="flex items-center">
            <Package className="h-5 w-5 mr-2 text-[#437358]" />
            Order History
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Loading order history...</p>
        ) : orders.length === 0 ? (
          <div className="text-center py-8">
            <Package className="h-12 w-12 mx-auto text-muted-foreground opacity-20" />
            <p className="mt-2 text-muted-foreground">You don't have any orders yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order Date</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">
                      {formatDate(order.created_at)}
                    </TableCell>
                    <TableCell>
                      {order.order_items.map((item, index) => (
                        <div key={item.id} className={index > 0 ? "mt-1" : ""}>
                          {item.quantity} × {item.product?.name || `${item.product?.milk_type || "Unknown"} Milk`}
                        </div>
                      ))}
                    </TableCell>
                    <TableCell className="text-right">
                      ₹{order.total_amount.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {getPaymentMethodBadge(order.payment_method || "wallet")}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(order.status)}
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
