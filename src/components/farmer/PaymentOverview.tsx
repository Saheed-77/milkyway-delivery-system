
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { Loader2, BanknoteIcon } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface Payment {
  id: string;
  amount: number;
  payment_date: string;
  status: string;
  notes: string | null;
}

interface MilkSummary {
  total_quantity: number;
  total_pending_payment: number;
}

export const PaymentOverview = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [milkSummary, setMilkSummary] = useState<MilkSummary>({
    total_quantity: 0,
    total_pending_payment: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPaymentsData = async () => {
      try {
        // Fetch recent payments
        const { data: paymentsData, error: paymentsError } = await supabase
          .from("farmer_payments")
          .select("*")
          .order("payment_date", { ascending: false })
          .limit(5);

        if (paymentsError) throw paymentsError;
        setPayments(paymentsData || []);

        // Calculate milk totals for the current month
        const currentDate = new Date();
        const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        
        const { data: milkData, error: milkError } = await supabase
          .from("milk_contributions")
          .select("quantity")
          .gte("contribution_date", firstDayOfMonth.toISOString().split('T')[0]);

        if (milkError) throw milkError;

        const totalQuantity = milkData?.reduce((sum, item) => sum + item.quantity, 0) || 0;
        
        // Assume a rate of $0.50 per liter
        const estimatedPayment = totalQuantity * 0.5;
        
        setMilkSummary({
          total_quantity: totalQuantity,
          total_pending_payment: estimatedPayment,
        });
      } catch (error) {
        console.error("Error fetching payment data:", error);
        toast({
          title: "Error",
          description: "Failed to load your payment information.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchPaymentsData();
  }, []);

  // Format payment status for display
  const formatStatus = (status: string) => {
    switch (status) {
      case "pending":
        return <span className="text-yellow-500 font-medium">Pending</span>;
      case "completed":
        return <span className="text-green-500 font-medium">Completed</span>;
      case "failed":
        return <span className="text-red-500 font-medium">Failed</span>;
      default:
        return <span>{status}</span>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Overview</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-green-700">This Month's Milk</p>
                <p className="text-2xl font-bold">{milkSummary.total_quantity.toFixed(1)} L</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-700">Pending Payment</p>
                <p className="text-2xl font-bold">${milkSummary.total_pending_payment.toFixed(2)}</p>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="font-medium mb-2 flex items-center">
                <BanknoteIcon className="mr-2 h-4 w-4" />
                Recent Payments
              </h3>
              
              {payments.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>
                          {format(new Date(payment.payment_date), "PPP")}
                        </TableCell>
                        <TableCell>${payment.amount.toFixed(2)}</TableCell>
                        <TableCell>{formatStatus(payment.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-center py-4">
                  No payment records found.
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
