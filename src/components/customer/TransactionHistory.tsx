
import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Receipt, ArrowUp, ArrowDown, Download } from "lucide-react";
import { generatePDF, formatCurrency } from "@/utils/pdfGenerator";

interface Transaction {
  id: string;
  amount: number;
  created_at: string;
  status: string;
  transaction_type: string;
}

export const TransactionHistory = ({ refreshTrigger = 0 }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [customerName, setCustomerName] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchTransactions();
  }, [refreshTrigger]);

  const fetchTransactions = async () => {
    try {
      setIsLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
      
      // Get customer profile for the PDF header
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", session.user.id)
        .single();
        
      if (profile) {
        setCustomerName(`${profile.first_name || ''} ${profile.last_name || ''}`.trim());
      }
    } catch (error) {
      console.error("Error fetching transactions:", error);
      toast({
        title: "Error",
        description: "Failed to load transaction history",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportPDF = () => {
    const columns = [
      { header: 'Type', dataKey: 'type' },
      { header: 'Date', dataKey: 'date' },
      { header: 'Amount', dataKey: 'amount' },
      { header: 'Status', dataKey: 'status' },
    ];
    
    const data = transactions.map(transaction => {
      return {
        type: transaction.transaction_type.charAt(0).toUpperCase() + transaction.transaction_type.slice(1),
        date: formatDate(transaction.created_at),
        amount: `${transaction.transaction_type === 'deposit' ? '+ ' : '- '}${formatCurrency(Math.abs(transaction.amount))}`,
        status: transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)
      };
    });
    
    const subtitle = customerName ? `Customer: ${customerName}` : undefined;
    
    generatePDF(columns, data, { 
      title: 'Wallet Transaction History',
      fileName: 'transaction-history',
      subtitle,
      footerText: 'Farm Fresh Dairy - Customer Transactions Report',
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'deposit':
        return <ArrowDown className="h-4 w-4 text-green-500" />;
      case 'order':
        return <ArrowUp className="h-4 w-4 text-red-500" />;
      default:
        return <Receipt className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600';
      case 'pending':
        return 'text-amber-600';
      case 'failed':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-[#437358]" />
          Transaction History
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
          <p className="text-center py-4">Loading transactions...</p>
        ) : transactions.length === 0 ? (
          <p className="text-center py-4 text-muted-foreground">No transactions found</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell className="flex items-center gap-2">
                    {getTransactionIcon(transaction.transaction_type)}
                    <span className="capitalize">{transaction.transaction_type}</span>
                  </TableCell>
                  <TableCell>{formatDate(transaction.created_at)}</TableCell>
                  <TableCell className={transaction.transaction_type === 'deposit' ? 'text-green-600' : 'text-red-600'}>
                    {transaction.transaction_type === 'deposit' ? '+ ' : '- '}
                    ₹{Math.abs(transaction.amount).toFixed(2)}
                  </TableCell>
                  <TableCell className={getStatusColor(transaction.status)}>
                    <span className="capitalize">{transaction.status}</span>
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
