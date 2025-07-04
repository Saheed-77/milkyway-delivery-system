import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { requestFarmerPayment } from "@/lib/rpc";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wallet, History, TrendingUp, ArrowUp, Send } from "lucide-react";

interface Payment {
  id: string;
  amount: number;
  payment_date: string;
  status: string;
}

interface MilkContribution {
  id: string;
  quantity: number;
  milk_type: string;
  contribution_date: string;
  payment_id: string | null;
}

interface Pricing {
  milk_type: string;
  price_per_liter: number;
}

interface PaymentOverviewProps {
  farmerId?: string;
}

export const PaymentOverview = ({ farmerId }: PaymentOverviewProps) => {
  const { toast } = useToast();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [pendingAmount, setPendingAmount] = useState(0);
  const [unpaidEstimate, setUnpaidEstimate] = useState(0);
  const [unpaidLiters, setUnpaidLiters] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRequesting, setIsRequesting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!farmerId) return;
    setIsLoading(true);
    try {
      const [{ data: paymentsData, error: paymentsError }, { data: contributionsData, error: contributionsError }, { data: pricingData }] =
        await Promise.all([
          supabase
            .from("farmer_payments")
            .select("id, amount, payment_date, status")
            .eq("farmer_id", farmerId)
            .order("payment_date", { ascending: false })
            .limit(5),
          supabase
            .from("milk_contributions")
            .select("id, quantity, milk_type, contribution_date, payment_id")
            .eq("farmer_id", farmerId)
            .order("contribution_date", { ascending: false })
            .limit(100),
          supabase
            .from("milk_pricing")
            .select("milk_type, price_per_liter")
            .order("effective_from", { ascending: false }),
        ]);

      if (paymentsError) throw paymentsError;
      if (contributionsError) throw contributionsError;

      const paymentList = (paymentsData ?? []) as Payment[];
      setPayments(paymentList);
      setTotalEarnings(
        paymentList
          .filter((p) => p.status === "approved")
          .reduce((sum, p) => sum + p.amount, 0)
      );
      setPendingAmount(
        paymentList
          .filter((p) => p.status === "pending")
          .reduce((sum, p) => sum + p.amount, 0)
      );

      const latestPrice = new Map<string, number>();
      for (const p of (pricingData ?? []) as Pricing[]) {
        if (!latestPrice.has(p.milk_type)) latestPrice.set(p.milk_type, p.price_per_liter);
      }

      const unpaid = ((contributionsData ?? []) as MilkContribution[]).filter(
        (c) => !c.payment_id
      );
      setUnpaidLiters(unpaid.reduce((sum, c) => sum + c.quantity, 0));
      setUnpaidEstimate(
        unpaid.reduce((sum, c) => sum + c.quantity * (latestPrice.get(c.milk_type) ?? 0), 0)
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load your payment information.";
      toast({ title: "Error loading payments", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [farmerId, toast]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleRequestPayment = async () => {
    setIsRequesting(true);
    try {
      await requestFarmerPayment();
      toast({
        title: "Payment requested",
        description: "Your payment request was submitted for admin approval.",
      });
      await fetchData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to request payment.";
      toast({ title: "Request failed", description: message, variant: "destructive" });
    } finally {
      setIsRequesting(false);
    }
  };

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
      case "approved":
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6 flex flex-col items-center">
            <div className="rounded-full p-2 bg-green-100 mb-2">
              <Wallet className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-sm text-muted-foreground mb-1">Total Earned</p>
            <p className="text-2xl font-bold text-green-600">₹{totalEarnings.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex flex-col items-center">
            <div className="rounded-full p-2 bg-amber-100 mb-2">
              <History className="h-5 w-5 text-amber-600" />
            </div>
            <p className="text-sm text-muted-foreground mb-1">Pending Approval</p>
            <p className="text-2xl font-bold text-amber-600">₹{pendingAmount.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex flex-col items-center">
            <div className="rounded-full p-2 bg-blue-100 mb-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
            </div>
            <p className="text-sm text-muted-foreground mb-1">Unpaid (est.)</p>
            <p className="text-2xl font-bold text-blue-600">₹{unpaidEstimate.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex flex-col items-center">
            <div className="rounded-full p-2 bg-purple-100 mb-2">
              <ArrowUp className="h-5 w-5 text-purple-600" />
            </div>
            <p className="text-sm text-muted-foreground mb-1">Unpaid Liters</p>
            <p className="text-2xl font-bold text-purple-600">{unpaidLiters.toFixed(1)} L</p>
          </CardContent>
        </Card>
      </div>

      {unpaidLiters > 0 && (
        <Button
          onClick={handleRequestPayment}
          disabled={isRequesting}
          className="w-full bg-[#437358] hover:bg-[#386349]"
        >
          <Send className="h-4 w-4 mr-2" />
          {isRequesting
            ? "Submitting..."
            : `Request Payment for ${unpaidLiters.toFixed(1)} L (~₹${unpaidEstimate.toFixed(2)})`}
        </Button>
      )}

      <h3 className="text-sm font-medium mt-4">Recent Payments</h3>
      {payments.length === 0 ? (
        <p className="text-center py-4 text-sm text-muted-foreground">
          No payment records found.
        </p>
      ) : (
        <div className="space-y-2">
          {payments.map((payment) => (
            <div
              key={payment.id}
              className="flex justify-between items-center p-3 border rounded-md"
            >
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
