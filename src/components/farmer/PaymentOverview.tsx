
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface Payment {
  id: string;
  amount: number;
  payment_date: string;
  status: string;
  notes: string | null;
}

interface PaymentOverviewProps {
  farmerId?: string;
}

export const PaymentOverview = ({ farmerId }: PaymentOverviewProps) => {
  const { toast } = useToast();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [totalEarnings, setTotalEarnings] = useState<number>(0);
  const [pendingAmount, setPendingAmount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!farmerId) return;

    const fetchPayments = async () => {
      setIsLoading(true);
      try {
        // Fetch recent payments
        const { data, error } = await supabase
          .from("farmer_payments")
          .select("*")
          .eq("farmer_id", farmerId)
          .order("payment_date", { ascending: false })
          .limit(5);

        if (error) throw error;
        setPayments(data || []);

        // Calculate total earnings (completed payments)
        const completedPayments = data?.filter(p => p.status === "completed") || [];
        const total = completedPayments.reduce((sum, payment) => sum + payment.amount, 0);
        setTotalEarnings(total);

        // Calculate pending amount
        const pending = data?.filter(p => p.status === "pending") || [];
        const pendingTotal = pending.reduce((sum, payment) => sum + payment.amount, 0);
        setPendingAmount(pendingTotal);
      } catch (error: any) {
        toast({
          title: "Error loading payments",
          description: error.message || "Failed to load your payment information.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchPayments();
  }, [farmerId, toast]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 hover:bg-green-100/80";
      case "pending":
        return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100/80";
      case "rejected":
        return "bg-red-100 text-red-800 hover:bg-red-100/80";
      default:
        return "bg-gray-100 text-gray-800 hover:bg-gray-100/80";
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6 flex flex-col items-center">
            <p className="text-sm text-muted-foreground mb-1">Total Earned</p>
            <p className="text-2xl font-bold text-green-600">₹{totalEarnings.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex flex-col items-center">
            <p className="text-sm text-muted-foreground mb-1">Pending</p>
            <p className="text-2xl font-bold text-amber-600">₹{pendingAmount.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      <h3 className="text-sm font-medium mt-4">Recent Payments</h3>
      {payments.length === 0 ? (
        <p className="text-center py-4 text-sm text-muted-foreground">
          No payment records found.
        </p>
      ) : (
        <div className="space-y-2">
          {payments.map((payment) => (
            <div key={payment.id} className="flex justify-between items-center p-3 border rounded-md">
              <div>
                <p className="font-medium">₹{payment.amount.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(payment.payment_date), "MMM d, yyyy")}
                </p>
              </div>
              <Badge className={getStatusColor(payment.status)}>
                {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
