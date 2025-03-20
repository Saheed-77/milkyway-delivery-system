
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface FarmerContribution {
  id: string;
  farmer_id: string;
  farmer_name: string;
  total_contribution: number;
  total_amount: number;
  last_contribution: string;
  payment_status: 'pending' | 'completed';
}

export const FarmerPaymentApproval = () => {
  const [contributions, setContributions] = useState<FarmerContribution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadFarmerContributions();
  }, []);

  const loadFarmerContributions = async () => {
    setIsLoading(true);
    try {
      // Get all farmers with pending payments based on their contributions
      const { data: farmerData, error: farmerError } = await supabase
        .from('profiles')
        .select(`
          id,
          first_name,
          last_name,
          farmers!inner (*)
        `)
        .eq('user_type', 'farmer')
        .eq('status', 'approved');

      if (farmerError) throw farmerError;

      if (!farmerData || farmerData.length === 0) {
        setContributions([]);
        setIsLoading(false);
        return;
      }

      // For each farmer, get their contributions that haven't been paid yet
      const farmersWithContributions = await Promise.all(
        farmerData.map(async (farmer) => {
          // Get sum of contributions that don't have a corresponding payment or have pending payment
          const { data: contributionData, error: contributionError } = await supabase
            .from('milk_contributions')
            .select('*, farmer_payments!left(id, status)')
            .eq('farmer_id', farmer.id)
            .is('payment_id', null);

          if (contributionError) throw contributionError;

          // Get the most recent payment to check status
          const { data: paymentData, error: paymentError } = await supabase
            .from('farmer_payments')
            .select('*')
            .eq('farmer_id', farmer.id)
            .order('created_at', { ascending: false })
            .limit(1);

          if (paymentError) throw paymentError;

          const paymentStatus = paymentData && paymentData.length > 0 
            ? paymentData[0].status 
            : 'pending';

          // Calculate total contribution and amount
          const totalContribution = contributionData?.reduce((sum, item) => sum + item.quantity, 0) || 0;
          const totalAmount = contributionData?.reduce((sum, item) => sum + (item.price || 0), 0) || 0;
          
          // Get the last contribution date
          const lastContribution = contributionData && contributionData.length > 0
            ? contributionData[contributionData.length - 1].contribution_date
            : null;

          return {
            id: farmer.id,
            farmer_id: farmer.id,
            farmer_name: `${farmer.first_name || ''} ${farmer.last_name || ''}`.trim() || farmer.id,
            total_contribution: totalContribution,
            total_amount: totalAmount,
            last_contribution: lastContribution,
            payment_status: paymentStatus as 'pending' | 'completed'
          };
        })
      );

      // Filter out farmers with no pending contributions
      const farmersWithPendingPayments = farmersWithContributions.filter(
        farmer => farmer.total_amount > 0
      );

      setContributions(farmersWithPendingPayments);
    } catch (error) {
      console.error("Error loading farmer contributions:", error);
      toast({
        title: "Error",
        description: "Failed to load farmer contribution data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const approvePayment = async (farmerId: string, amount: number) => {
    setIsProcessing(farmerId);
    try {
      // 1. Create a new payment record
      const { data: paymentData, error: paymentError } = await supabase
        .from('farmer_payments')
        .insert({
          farmer_id: farmerId,
          amount: amount,
          status: 'completed',
          notes: 'Payment for milk contributions'
        })
        .select();

      if (paymentError) throw paymentError;

      if (!paymentData || paymentData.length === 0) {
        throw new Error("Failed to create payment record");
      }

      // 2. Add funds to farmer's wallet
      const { error: walletError } = await supabase
        .from('wallet_transactions')
        .insert({
          user_id: farmerId,
          amount: amount,
          transaction_type: 'deposit',
          status: 'completed'
        });

      if (walletError) throw walletError;

      // 3. Mark all unpaid contributions as paid by linking them to this payment
      // Define the correct parameter types for the RPC call
      type LinkContributionsParams = {
        farmer_id: string;
        payment_id: string;
      }
      
      const { error: contributionError } = await supabase.rpc<void, LinkContributionsParams>(
        'link_contributions_to_payment',
        {
          farmer_id: farmerId,
          payment_id: paymentData[0].id
        }
      );

      if (contributionError) {
        console.error("Error linking contributions:", contributionError);
        // If this fails, we still processed the payment, so we'll continue
      }

      toast({
        title: "Payment Approved",
        description: `Successfully approved payment of ₹${amount.toFixed(2)} to farmer`,
      });

      // Refresh the list
      loadFarmerContributions();
    } catch (error) {
      console.error("Error approving payment:", error);
      toast({
        title: "Error",
        description: "Failed to approve payment",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Farmer Payments</CardTitle>
        <CardDescription>Approve payments for milk contributions</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : contributions.length === 0 ? (
          <p className="text-center py-6 text-muted-foreground">No pending payments to approve</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Farmer</TableHead>
                <TableHead>Total Contribution (L)</TableHead>
                <TableHead>Amount (₹)</TableHead>
                <TableHead>Last Contribution</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contributions.map((contribution) => (
                <TableRow key={contribution.id}>
                  <TableCell className="font-medium">{contribution.farmer_name}</TableCell>
                  <TableCell>{contribution.total_contribution.toFixed(1)}</TableCell>
                  <TableCell>₹{contribution.total_amount.toFixed(2)}</TableCell>
                  <TableCell>
                    {contribution.last_contribution 
                      ? format(new Date(contribution.last_contribution), "MMM d, yyyy")
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      className={
                        contribution.payment_status === 'completed' 
                          ? "bg-green-100 text-green-800" 
                          : "bg-yellow-100 text-yellow-800"
                      }
                    >
                      {contribution.payment_status === 'completed' ? 'Completed' : 'Pending'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-[#437358] text-white hover:bg-[#345c46]"
                      disabled={isProcessing === contribution.id || contribution.payment_status === 'completed'}
                      onClick={() => approvePayment(contribution.id, contribution.total_amount)}
                    >
                      {isProcessing === contribution.id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing
                        </>
                      ) : (
                        'Approve Payment'
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
