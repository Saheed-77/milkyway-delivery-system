
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";

export const OrderActions = ({ order, onStatusUpdate }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleMarkAsDelivered = async () => {
    if (order.status !== "pending") return;
    
    setIsProcessing(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("You must be logged in");
      
      // Start a transaction-like flow
      
      // 1. Update order status to delivered
      const { error: orderError } = await supabase
        .from("orders")
        .update({ status: "delivered" })
        .eq("id", order.id)
        .eq("customer_id", session.user.id) // Security check
        .eq("status", "pending"); // Only pending orders can be marked as delivered
      
      if (orderError) throw new Error("Failed to update order status: " + orderError.message);
      
      // 2. Create wallet transaction for payment (deduction)
      const { error: walletError } = await supabase
        .from("wallet_transactions")
        .insert({
          user_id: session.user.id,
          amount: order.total_amount,
          transaction_type: "withdrawal",
          status: "completed"
        });
      
      if (walletError) {
        // Rollback the order status update
        await supabase
          .from("orders")
          .update({ status: "pending" })
          .eq("id", order.id);
          
        throw new Error("Failed to process payment: " + walletError.message);
      }
      
      toast({
        title: "Order Marked as Delivered",
        description: `₹${order.total_amount.toFixed(2)} has been deducted from your wallet.`,
      });
      
      // Call the callback to update UI
      if (onStatusUpdate) onStatusUpdate(order.id, "delivered");
      
    } catch (error) {
      console.error("Error marking order as delivered:", error);
      toast({
        title: "Action Failed",
        description: error.message || "There was an error processing your request.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Only show the delivered button for pending orders
  if (order.status !== "pending") return null;
  
  return (
    <Button
      variant="outline"
      size="sm"
      className="text-green-600 border-green-600 hover:bg-green-50"
      disabled={isProcessing}
      onClick={handleMarkAsDelivered}
    >
      <CheckCircle className="h-4 w-4 mr-1" />
      {isProcessing ? "Processing..." : "Mark as Delivered"}
    </Button>
  );
};
