
import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, X, FileText } from "lucide-react";
import { format } from "date-fns";

export const FarmerPaymentApproval = () => {
  const [payments, setPayments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      const { data, error } = await supabase
        .from("farmer_payments")
        .select(`
          *,
          farmer:profiles!farmer_id (
            email,
            first_name,
            last_name
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPayments(data || []);
    } catch (error) {
      console.error("Error fetching payments:", error);
      toast({
        title: "Error",
        description: "Failed to load farmer payments. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updatePaymentStatus = async (paymentId, status) => {
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from("farmer_payments")
        .update({ status })
        .eq("id", paymentId);

      if (error) throw error;

      // Update the payments list
      setPayments(payments.map(payment => 
        payment.id === paymentId ? { ...payment, status } : payment
      ));

      toast({
        title: status === "approved" ? "Payment Approved" : "Payment Rejected",
        description: `The payment has been ${status}.`,
      });
    } catch (error) {
      console.error("Error updating payment status:", error);
      toast({
        title: "Error",
        description: "Failed to update payment status. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "rejected":
        return <X className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-yellow-500" />;
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center">
          <FileText className="h-5 w-5 mr-2 text-[#437358]" />
          Farmer Payment Approval
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Loading payments...</p>
        ) : payments.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground opacity-20" />
            <p className="mt-2 text-muted-foreground">No payments to approve</p>
          </div>
        ) : (
          <div className="space-y-3">
            {payments.map((payment) => (
              <div 
                key={payment.id} 
                className="p-3 border rounded-lg flex justify-between items-center"
              >
                <div>
                  <h4 className="font-medium">
                    {payment.farmer?.first_name || "Unnamed"} {payment.farmer?.last_name || "Farmer"}
                  </h4>
                  <p className="text-sm">
                    {payment.farmer?.email || "No email"}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-medium">
                      {formatCurrency(payment.amount)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(payment.payment_date), "MMM dd, yyyy")}
                    </span>
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-gray-100 rounded-full">
                      {getStatusIcon(payment.status)}
                      <span className="capitalize">{payment.status}</span>
                    </span>
                  </div>
                </div>
                {payment.status === "pending" && (
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="border-green-200 text-green-600 hover:bg-green-50 hover:text-green-700"
                      disabled={isProcessing}
                      onClick={() => updatePaymentStatus(payment.id, "approved")}
                    >
                      Approve
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                      disabled={isProcessing}
                      onClick={() => updatePaymentStatus(payment.id, "rejected")}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
