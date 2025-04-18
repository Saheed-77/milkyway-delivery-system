
import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, X, FileText, Download } from "lucide-react";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { generatePDF, formatCurrency } from "@/utils/pdfGenerator";

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
  farmer_id?: string;
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
      
      // For each payment, fetch the linked contributions or unpaid contributions
      const paymentsWithContributions = await Promise.all(
        (paymentsData || []).map(async (payment) => {
          // First check for already linked contributions
          const { data: linkedContributions, error: linkedError } = await supabase
            .from("milk_contributions")
            .select("id, quantity, milk_type, contribution_date")
            .eq("payment_id", payment.id);
          
          if (linkedError) {
            console.error("Error fetching linked contributions:", linkedError);
          }
          
          // If we don't have linked contributions, try to find unlinked ones
          // that could be associated with this payment
          if (!linkedContributions || linkedContributions.length === 0) {
            const { data: unlinkedContributions, error: unlinkedError } = await supabase
              .from("milk_contributions")
              .select("id, quantity, milk_type, contribution_date")
              .eq("farmer_id", payment.farmer_id)
              .is("payment_id", null)
              .order("contribution_date", { ascending: true });
            
            if (unlinkedError) {
              console.error("Error fetching unlinked contributions:", unlinkedError);
              return { ...payment, contributions: [] };
            }
            
            return { ...payment, contributions: unlinkedContributions || [] };
          }
          
          return { ...payment, contributions: linkedContributions || [] };
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
      const payment = payments.find(p => p.id === paymentId);
      
      // First update the payment status
      const { error } = await supabase
        .from("farmer_payments")
        .update({ status })
        .eq("id", paymentId);

      if (error) throw error;
      
      // If approved, link the contributions to this payment
      if (status === "approved" && payment?.contributions?.length > 0) {
        for (const contribution of payment.contributions) {
          const { error: updateError } = await supabase
            .from("milk_contributions")
            .update({ payment_id: paymentId })
            .eq("id", contribution.id);
          
          if (updateError) {
            console.error(`Error linking contribution ${contribution.id}:`, updateError);
          }
        }
      }

      // Update the payments list
      setPayments(payments.map(payment => 
        payment.id === paymentId ? { ...payment, status } : payment
      ));

      toast({
        title: status === "approved" ? "Payment Approved" : "Payment Rejected",
        description: `The payment has been ${status}.`,
      });
      
      // Refresh the payments data
      fetchPayments();
      
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

  const formatCurrencyValue = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const handleExportPDF = () => {
    const columns = [
      { header: 'Farmer', dataKey: 'farmer' },
      { header: 'Amount', dataKey: 'amount' },
      { header: 'Date', dataKey: 'date' },
      { header: 'Status', dataKey: 'status' },
      { header: 'Contributions', dataKey: 'contributions' },
    ];
    
    const data = payments.map(payment => {
      return {
        farmer: `${payment.farmer?.first_name || ''} ${payment.farmer?.last_name || ''}`.trim(),
        amount: formatCurrencyValue(payment.amount),
        date: format(new Date(payment.payment_date), "MMM dd, yyyy"),
        status: payment.status.charAt(0).toUpperCase() + payment.status.slice(1),
        contributions: payment.contributions?.length || 0
      };
    });
    
    // Calculate total by status
    const totalPending = payments
      .filter(p => p.status === 'pending')
      .reduce((sum, p) => sum + p.amount, 0);
    
    const totalApproved = payments
      .filter(p => p.status === 'approved')
      .reduce((sum, p) => sum + p.amount, 0);
    
    const subtitle = `Total Pending: ${formatCurrencyValue(totalPending)} | Total Approved: ${formatCurrencyValue(totalApproved)}`;
    
    generatePDF(columns, data, { 
      title: 'Farmer Payments Report',
      fileName: 'farmer-payments',
      subtitle,
      footerText: 'Farm Fresh Dairy - Admin Payment Report',
      orientation: 'landscape'
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center">
          <FileText className="h-5 w-5 mr-2 text-[#437358]" />
          Farmer Payment Approval
        </CardTitle>
        <Button 
          variant="outline" 
          size="sm" 
          className="flex items-center gap-1" 
          onClick={handleExportPDF}
        >
          <Download className="h-4 w-4" />
          Export PDF
        </Button>
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
                        {formatCurrencyValue(payment.amount)}
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
