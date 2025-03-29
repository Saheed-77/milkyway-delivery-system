
import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, X, FileText } from "lucide-react";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface FarmerPayment {
  id: string;
  amount: number;
  status: string;
  payment_date: string;
  created_at: string;
  farmer: {
    email: string;
    first_name: string;
    last_name: string;
  };
  contributions?: {
    id: string;
    quantity: number;
    milk_type: string;
    contribution_date: string;
  }[];
}

export const FarmerPaymentApproval = () => {
  const [payments, setPayments] = useState<FarmerPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      // Fetch payments with farmer profiles
      const { data: paymentsData, error: paymentsError } = await supabase
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

      if (paymentsError) throw paymentsError;
      
      // For each payment, fetch the linked contributions
      const paymentsWithContributions = await Promise.all(
        (paymentsData || []).map(async (payment) => {
          const { data: contributions, error: contribError } = await supabase
            .from("milk_contributions")
            .select("id, quantity, milk_type, contribution_date")
            .eq("payment_id", payment.id);
          
          if (contribError) {
            console.error("Error fetching contributions for payment:", contribError);
            return { ...payment, contributions: [] };
          }
          
          return { ...payment, contributions: contributions || [] };
        })
      );

      setPayments(paymentsWithContributions || []);
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
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Farmer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {payment.farmer?.first_name || ""} {payment.farmer?.last_name || ""}
                        </p>
                        <p className="text-sm text-muted-foreground">{payment.farmer?.email || ""}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">
                        {formatCurrency(payment.amount)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {format(new Date(payment.payment_date), "MMM dd, yyyy")}
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-gray-100 rounded-full">
                        {getStatusIcon(payment.status)}
                        <span className="capitalize">{payment.status}</span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {payment.contributions?.length || 0} contributions
                      </span>
                    </TableCell>
                    <TableCell>
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
