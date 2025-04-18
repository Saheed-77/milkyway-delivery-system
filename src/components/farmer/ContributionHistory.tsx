
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { generatePDF, formatCurrency } from "@/utils/pdfGenerator";

interface MilkContribution {
  id: string;
  quantity: number;
  milk_type: string;
  contribution_date: string;
  quality_rating: number | null;
  created_at: string;
  price: number;
  payment_id: string;
  payment_status?: string;
}

interface ContributionHistoryProps {
  farmerId?: string;
}

export const ContributionHistory = ({ farmerId }: ContributionHistoryProps) => {
  const { toast } = useToast();
  const [contributions, setContributions] = useState<MilkContribution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingPayments, setPendingPayments] = useState<number>(0);

  useEffect(() => {
    if (!farmerId) return;

    const fetchContributions = async () => {
      setIsLoading(true);
      try {
        // Get milk contributions with payment status
        const { data, error } = await supabase
          .from("milk_contributions")
          .select(`
            id,
            quantity,
            milk_type,
            contribution_date,
            quality_rating,
            created_at,
            price,
            payment_id,
            farmer_payments(status)
          `)
          .eq("farmer_id", farmerId)
          .order("contribution_date", { ascending: false })
          .limit(20);

        if (error) throw error;
        
        // Transform data to include payment status
        const transformedData = data?.map(contribution => ({
          ...contribution,
          payment_status: contribution.farmer_payments?.status || 'pending'
        })) || [];
        
        setContributions(transformedData);

        // Calculate pending payments
        const pending = transformedData.filter(c => c.payment_status === 'pending');
        const pendingAmount = pending.reduce((sum, c) => sum + (c.price || 0), 0);
        setPendingPayments(pendingAmount);
      } catch (error: any) {
        toast({
          title: "Error loading contributions",
          description: error.message || "Failed to load your contribution history.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchContributions();
  }, [farmerId, toast]);

  const handleExportPDF = () => {
    const columns = [
      { header: 'Date', dataKey: 'date' },
      { header: 'Milk Type', dataKey: 'milk_type' },
      { header: 'Quantity (L)', dataKey: 'quantity' },
      { header: 'Price/L', dataKey: 'price_per_liter' },
      { header: 'Amount', dataKey: 'amount' },
      { header: 'Quality', dataKey: 'quality' },
      { header: 'Payment', dataKey: 'payment' },
    ];
    
    const data = contributions.map(contribution => {
      const pricePerLiter = contribution.quantity > 0 ? contribution.price / contribution.quantity : 0;
      let quality = 'Pending';
      if (contribution.quality_rating === 1) quality = 'A (Excellent)';
      if (contribution.quality_rating === 2) quality = 'B (Good)';
      if (contribution.quality_rating === 3) quality = 'C (Below Standard)';
      
      return {
        date: format(new Date(contribution.contribution_date), "MMM d, yyyy"),
        milk_type: formatMilkType(contribution.milk_type),
        quantity: contribution.quantity === 0 ? 'Rejected' : contribution.quantity,
        price_per_liter: contribution.quantity === 0 ? 'N/A' : formatCurrency(pricePerLiter),
        amount: contribution.quantity === 0 ? '₹0.00' : formatCurrency(contribution.price),
        quality: quality,
        payment: contribution.payment_status.charAt(0).toUpperCase() + contribution.payment_status.slice(1)
      };
    });
    
    generatePDF(columns, data, { 
      title: 'Milk Contribution History',
      fileName: 'contribution-history',
      subtitle: `Total Pending Payments: ${formatCurrency(pendingPayments)}`,
      footerText: 'Farm Fresh Dairy - Farmer Contributions Report',
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="w-full h-12" />
        ))}
      </div>
    );
  }

  if (contributions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No contributions recorded yet. Contact an administrator to record your contributions.
      </div>
    );
  }

  const formatMilkType = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  const getQualityBadge = (rating: number | null) => {
    if (rating === null) return <Badge className="bg-gray-100 text-gray-800">Pending</Badge>;
    
    switch (rating) {
      case 1:
        return <Badge className="bg-green-100 text-green-800">A (Excellent)</Badge>;
      case 2:
        return <Badge className="bg-blue-100 text-blue-800">B (Good)</Badge>;
      case 3:
        return <Badge className="bg-red-100 text-red-800">C (Below Standard)</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">Unknown</Badge>;
    }
  };

  const getRejectionInfo = (contribution: MilkContribution) => {
    if (contribution.quality_rating === 3 && contribution.quantity === 0) {
      return (
        <div className="mt-1">
          <Badge variant="destructive" className="text-xs">Rejected</Badge>
          <p className="text-xs text-red-600 mt-1">
            This milk was rejected due to substandard quality.
          </p>
        </div>
      );
    }
    return null;
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Paid</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800">Rejected</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">{status}</Badge>;
    }
  };

  return (
    <div>
      <div className="flex justify-between mb-4">
        {pendingPayments > 0 && (
          <div className="text-sm text-amber-600 font-medium">
            Pending Payments: {formatCurrency(pendingPayments)}
          </div>
        )}
        <Button 
          variant="outline" 
          size="sm" 
          className="ml-auto flex items-center gap-1" 
          onClick={handleExportPDF}
        >
          <Download className="h-4 w-4" />
          Export PDF
        </Button>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Milk Type</TableHead>
              <TableHead>Quantity (L)</TableHead>
              <TableHead>Price/L</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Quality</TableHead>
              <TableHead>Payment</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contributions.map((contribution) => (
              <TableRow 
                key={contribution.id}
                className={contribution.quality_rating === 3 ? "bg-red-50" : ""}
              >
                <TableCell>
                  {format(new Date(contribution.contribution_date), "MMM d, yyyy")}
                </TableCell>
                <TableCell>{formatMilkType(contribution.milk_type)}</TableCell>
                <TableCell>
                  {contribution.quantity === 0 ? (
                    <span className="text-red-600">Rejected</span>
                  ) : (
                    contribution.quantity
                  )}
                </TableCell>
                <TableCell>
                  {contribution.quantity === 0 ? (
                    "N/A"
                  ) : (
                    `₹${(contribution.price / contribution.quantity).toFixed(2)}`
                  )}
                </TableCell>
                <TableCell className="font-medium">
                  {contribution.quantity === 0 ? (
                    "₹0.00"
                  ) : (
                    `₹${contribution.price.toFixed(2)}`
                  )}
                </TableCell>
                <TableCell>
                  <div>
                    {getQualityBadge(contribution.quality_rating)}
                    {getRejectionInfo(contribution)}
                  </div>
                </TableCell>
                <TableCell>
                  {getPaymentStatusBadge(contribution.payment_status || 'pending')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
