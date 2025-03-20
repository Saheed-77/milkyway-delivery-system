
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Wallet, History, TrendingUp, ArrowUp } from "lucide-react";

interface Payment {
  id: string;
  amount: number;
  payment_date: string;
  status: string;
  notes: string | null;
}

interface MilkContribution {
  quantity: number;
  milk_type: string;
  contribution_date: string;
  price: number | null;
  payment_id: string | null;
}

interface PaymentOverviewProps {
  farmerId?: string;
}

export const PaymentOverview = ({ farmerId }: PaymentOverviewProps) => {
  const { toast } = useToast();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [totalEarnings, setTotalEarnings] = useState<number>(0);
  const [pendingAmount, setPendingAmount] = useState<number>(0);
  const [contributions, setContributions] = useState<MilkContribution[]>([]);
  const [potentialEarnings, setPotentialEarnings] = useState<number>(0);
  const [unpaidContributions, setUnpaidContributions] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!farmerId) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch recent payments
        const { data: paymentsData, error: paymentsError } = await supabase
          .from("farmer_payments")
          .select("*")
          .eq("farmer_id", farmerId)
          .order("payment_date", { ascending: false })
          .limit(5);

        if (paymentsError) throw paymentsError;
        setPayments(paymentsData || []);

        // Calculate total earnings (completed payments)
        const completedPayments = paymentsData?.filter(p => p.status === "completed") || [];
        const total = completedPayments.reduce((sum, payment) => sum + payment.amount, 0);
        setTotalEarnings(total);

        // Calculate pending amount
        const pending = paymentsData?.filter(p => p.status === "pending") || [];
        const pendingTotal = pending.reduce((sum, payment) => sum + payment.amount, 0);
        setPendingAmount(pendingTotal);

        // Fetch milk contributions with price and payment_id to determine if they've been paid
        const { data: contributionsData, error: contributionsError } = await supabase
          .from("milk_contributions")
          .select(`
            id, 
            quantity, 
            milk_type, 
            contribution_date,
            price,
            payment_id
          `)
          .eq("farmer_id", farmerId)
          .order("contribution_date", { ascending: false })
          .limit(30);

        if (contributionsError) throw contributionsError;

        // Ensure we're only using valid contribution data
        if (contributionsData) {
          setContributions(contributionsData as MilkContribution[]);

          // Calculate potential earnings based on contributions
          const potential = contributionsData.reduce(
            (sum, contrib) => sum + (contrib.price || 0), 
            0
          );
          setPotentialEarnings(potential || 0);

          // Calculate unpaid contributions (those without a payment_id)
          const unpaid = contributionsData.filter(c => !c.payment_id).reduce(
            (sum, contrib) => sum + (contrib.price || 0),
            0
          );
          setUnpaidContributions(unpaid || 0);
        }

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

    fetchData();
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
            <p className="text-sm text-muted-foreground mb-1">Pending</p>
            <p className="text-2xl font-bold text-amber-600">₹{pendingAmount.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex flex-col items-center">
            <div className="rounded-full p-2 bg-blue-100 mb-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
            </div>
            <p className="text-sm text-muted-foreground mb-1">Potential</p>
            <p className="text-2xl font-bold text-blue-600">₹{potentialEarnings.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex flex-col items-center">
            <div className="rounded-full p-2 bg-purple-100 mb-2">
              <ArrowUp className="h-5 w-5 text-purple-600" />
            </div>
            <p className="text-sm text-muted-foreground mb-1">Unpaid</p>
            <p className="text-2xl font-bold text-purple-600">₹{unpaidContributions.toFixed(2)}</p>
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
