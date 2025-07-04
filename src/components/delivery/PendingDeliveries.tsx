import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { completeDelivery } from "@/lib/rpc";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Package, Truck, MapPin, CreditCard, CheckCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface OrderItem {
  id: string;
  quantity: number;
  unit_price: number;
  product: { name: string | null; milk_type: string | null } | null;
}

interface PendingOrder {
  id: string;
  created_at: string;
  total_amount: number;
  status: string;
  payment_method: string;
  order_items: OrderItem[];
  customer: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    address: string | null;
    phone: string | null;
  } | null;
}

interface PendingDeliveriesProps {
  onStatusChange?: () => void;
}

export const PendingDeliveries = ({ onStatusChange }: PendingDeliveriesProps) => {
  const [pendingDeliveries, setPendingDeliveries] = useState<PendingOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchPendingDeliveries = useCallback(async () => {
    try {
      setIsLoading(true);

      const { data, error } = await supabase
        .from("orders")
        .select(
          `
          id,
          created_at,
          total_amount,
          status,
          payment_method,
          order_items (
            id,
            quantity,
            unit_price,
            product:products (
              name,
              milk_type
            )
          ),
          customer:profiles!customer_id (
            id,
            first_name,
            last_name,
            email,
            address,
            phone
          )
        `
        )
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      if (error) throw error;

      setPendingDeliveries((data ?? []) as unknown as PendingOrder[]);
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
  }, [toast]);

  useEffect(() => {
    void fetchPendingDeliveries();
  }, [fetchPendingDeliveries]);

  const handleMarkAsDelivered = async (orderId: string) => {
    setUpdatingOrderId(orderId);
    try {
      // Server-side RPC: verifies the caller is delivery staff and the
      // order is still deliverable, then completes it atomically.
      await completeDelivery(orderId);

      await fetchPendingDeliveries();
      onStatusChange?.();

      toast({ title: "Success", description: "Order marked as delivered" });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update order status";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return `${date.toLocaleDateString()} (${formatDistanceToNow(date, { addSuffix: true })})`;
    } catch {
      return dateString;
    }
  };

  const formatPaymentMethod = (method: string) => {
    switch (method) {
      case "cash":
      case "cod":
        return "Cash on Delivery";
      case "wallet":
        return "Wallet";
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
                      <div>
                        {order.customer?.first_name} {order.customer?.last_name}
                        {order.customer?.phone && (
                          <p className="text-xs text-muted-foreground">{order.customer.phone}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {order.order_items.map((item, index) => (
                        <div key={item.id} className={index > 0 ? "mt-1" : ""}>
                          {item.quantity} ×{" "}
                          {item.product?.name || `${item.product?.milk_type || "Unknown"} Milk`}
                        </div>
                      ))}
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <div className="flex items-start gap-1">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <span className="text-sm break-words">
                          {order.customer?.address || "Address not available"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        <span>{formatPaymentMethod(order.payment_method)}</span>
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(order.created_at)}</TableCell>
                    <TableCell>₹{order.total_amount.toFixed(2)}</TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-1 text-green-600 border-green-600 hover:bg-green-50"
                        onClick={() => handleMarkAsDelivered(order.id)}
                        disabled={updatingOrderId !== null}
                      >
                        <CheckCircle className="h-4 w-4" />
                        <span>{updatingOrderId === order.id ? "Updating..." : "Delivered"}</span>
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
