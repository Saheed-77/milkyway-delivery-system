import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { reviewFarmerPayment } from "@/lib/rpc";
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
import { generatePDF } from "@/utils/pdfGenerator";

interface Contribution {
  id: string;
  quantity: number;
  milk_type: string;
  contribution_date: string;
}

interface FarmerPayment {
  id: string;
  amount: number;
  status: string;
  payment_date: string;
  created_at: string;
  farmer_id: string;
  farmer: {
    email: string;
    first_name: string | null;
    last_name: string | null;
  } | null;
  contributions: Contribution[];
}

export const FarmerPaymentApproval = () => {
  const [payments, setPayments] = useState<FarmerPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchPayments = useCallback(async () => {
    try {
      const { data: paymentsData, error: paymentsError } = await supabase
        .from("farmer_payments")
        .select(
          `
          *,
          farmer:profiles!farmer_id (
            email,
            first_name,
            last_name
          )
        `
        )
        .order("created_at", { ascending: false });

      if (paymentsError) throw paymentsError;

      const paymentIds = (paymentsData ?? []).map((p) => p.id);
      let contributionsByPayment = new Map<string, Contribution[]>();

      if (paymentIds.length > 0) {
        // Single query instead of N+1. Contributions are linked to a payment
        // at request time by the request_farmer_payment RPC.
        const { data: contributions, error: contribError } = await supabase
          .from("milk_contributions")
          .select("id, quantity, milk_type, contribution_date, payment_id")
          .in("payment_id", paymentIds);

        if (contribError) {
          console.error("Error fetching contributions:", contribError);
        } else {
          contributionsByPayment = (contributions ?? []).reduce((map, c) => {
            const list = map.get(c.payment_id as string) ?? [];
            list.push(c as unknown as Contribution);
            map.set(c.payment_id as string, list);
            return map;
          }, new Map<string, Contribution[]>());
        }
      }

      setPayments(
        (paymentsData ?? []).map((p) => ({
          ...(p as unknown as Omit<FarmerPayment, "contributions">),
          contributions: contributionsByPayment.get(p.id) ?? [],
        }))
      );
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
  }, [toast]);

  useEffect(() => {
    void fetchPayments();
  }, [fetchPayments]);

  const handleReview = async (paymentId: string, approve: boolean) => {
    setProcessingId(paymentId);
    try {
      // Atomic server-side review: status change, contribution linking and
      // the farmer's wallet credit happen in one transaction, admin-only.
      await reviewFarmerPayment(paymentId, approve);

      toast({
        title: approve ? "Payment Approved" : "Payment Rejected",
        description: approve
          ? "The payment was approved and credited to the farmer's wallet."
          : "The payment was rejected and its contributions were released.",
      });

      await fetchPayments();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update payment status.";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "rejected":
        return <X className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-yellow-500" />;
    }
  };

  const formatCurrencyValue = (amount: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(amount);

  const handleExportPDF = () => {
    const columns = [
      { header: "Farmer", dataKey: "farmer" },
      { header: "Amount", dataKey: "amount" },
      { header: "Date", dataKey: "date" },
      { header: "Status", dataKey: "status" },
      { header: "Contributions", dataKey: "contributions" },
    ];

    const data = payments.map((payment) => ({
      farmer: `${payment.farmer?.first_name || ""} ${payment.farmer?.last_name || ""}`.trim(),
      amount: formatCurrencyValue(payment.amount),
      date: format(new Date(payment.payment_date), "MMM dd, yyyy"),
      status: payment.status.charAt(0).toUpperCase() + payment.status.slice(1),
      contributions: payment.contributions.length,
    }));

    const totalPending = payments
      .filter((p) => p.status === "pending")
      .reduce((sum, p) => sum + p.amount, 0);
    const totalApproved = payments
      .filter((p) => p.status === "approved")
      .reduce((sum, p) => sum + p.amount, 0);

    generatePDF(columns, data, {
      title: "Farmer Payments Report",
      fileName: "farmer-payments",
      subtitle: `Total Pending: ${formatCurrencyValue(totalPending)} | Total Approved: ${formatCurrencyValue(totalApproved)}`,
      footerText: "Farm Fresh Dairy - Admin Payment Report",
      orientation: "landscape",
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
                        <p className="text-sm text-muted-foreground">
                          {payment.farmer?.email || ""}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{formatCurrencyValue(payment.amount)}</span>
                    </TableCell>
                    <TableCell>{format(new Date(payment.payment_date), "MMM dd, yyyy")}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-gray-100 rounded-full">
                        {getStatusIcon(payment.status)}
                        <span className="capitalize">{payment.status}</span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {payment.contributions.length} contributions
                      </span>
                    </TableCell>
                    <TableCell>
                      {payment.status === "pending" && (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-green-200 text-green-600 hover:bg-green-50 hover:text-green-700"
                            disabled={processingId !== null}
                            onClick={() => handleReview(payment.id, true)}
                          >
                            {processingId === payment.id ? "Processing…" : "Approve"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                            disabled={processingId !== null}
                            onClick={() => handleReview(payment.id, false)}
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
