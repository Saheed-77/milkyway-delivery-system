
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getWalletBalance } from "@/lib/rpc";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet } from "lucide-react";

interface Transaction {
  id: string;
  amount: number;
  created_at: string;
  status: string;
  transaction_type: string;
}

interface FarmerWalletProps {
  farmerId?: string;
}

export const FarmerWallet = ({ farmerId }: FarmerWalletProps) => {
  const { toast } = useToast();
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!farmerId) return;

    const fetchWalletData = async () => {
      setIsLoading(true);
      try {
        // Recent transactions for display only; the balance comes from the
        // server so it reflects ALL transactions, not just the last 10.
        const [{ data, error }, serverBalance] = await Promise.all([
          supabase
            .from("wallet_transactions")
            .select("*")
            .eq("user_id", farmerId)
            .order("created_at", { ascending: false })
            .limit(10),
          getWalletBalance(),
        ]);

        if (error) throw error;
        setTransactions(data || []);
        setBalance(serverBalance ?? 0);
      } catch (error) {
        toast({
          title: "Error loading wallet",
          description: error.message || "Failed to load wallet information.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchWalletData();
  }, [farmerId, toast]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-800">Rejected</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">{status}</Badge>;
    }
  };

  const getTransactionTypeBadge = (type: string) => {
    switch (type) {
      case "deposit":
        return <Badge className="bg-blue-100 text-blue-800">Deposit</Badge>;
      case "withdrawal":
        return <Badge className="bg-purple-100 text-purple-800">Withdrawal</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6 flex items-center justify-between">
          <div className="flex items-center">
            <div className="rounded-full p-3 bg-[#f2fcf6] mr-4">
              <Wallet className="h-6 w-6 text-[#437358]" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Current Balance</p>
              <p className="text-3xl font-bold text-[#437358]">₹{balance.toFixed(2)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div>
        <h3 className="text-lg font-medium mb-4">Recent Transactions</h3>
        {transactions.length === 0 ? (
          <p className="text-center py-6 text-muted-foreground">No transactions found</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell>{format(new Date(transaction.created_at), "MMM d, yyyy")}</TableCell>
                  <TableCell>{getTransactionTypeBadge(transaction.transaction_type)}</TableCell>
                  <TableCell className={transaction.transaction_type === "deposit" ? "text-green-600" : "text-red-600"}>
                    {transaction.transaction_type === "deposit" ? "+" : "-"}₹{transaction.amount.toFixed(2)}
                  </TableCell>
                  <TableCell>{getStatusBadge(transaction.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};
