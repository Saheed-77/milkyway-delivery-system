
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface MilkContribution {
  id: string;
  quantity: number;
  milk_type: string;
  contribution_date: string;
  quality_rating: number | null;
  created_at: string;
  price_per_liter: number;
  calculated_amount: number;
}

interface ContributionHistoryProps {
  farmerId?: string;
}

export const ContributionHistory = ({ farmerId }: ContributionHistoryProps) => {
  const { toast } = useToast();
  const [contributions, setContributions] = useState<MilkContribution[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!farmerId) return;

    const fetchContributions = async () => {
      setIsLoading(true);
      try {
        // Get milk contributions with pricing info
        const { data, error } = await supabase
          .from("milk_contributions")
          .select(`
            *,
            milk_pricing!inner(price_per_liter)
          `)
          .eq("farmer_id", farmerId)
          .order("contribution_date", { ascending: false })
          .limit(20);

        if (error) throw error;
        
        // Calculate the amount for each contribution
        const contributionsWithAmount = data.map(contribution => ({
          ...contribution,
          price_per_liter: contribution.milk_pricing.price_per_liter,
          calculated_amount: contribution.quantity * contribution.milk_pricing.price_per_liter
        }));
        
        setContributions(contributionsWithAmount || []);
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
        return <Badge className="bg-yellow-100 text-yellow-800">C (Average)</Badge>;
      case 4:
        return <Badge className="bg-red-100 text-red-800">D (Below Standard)</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">Unknown</Badge>;
    }
  };

  return (
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
          </TableRow>
        </TableHeader>
        <TableBody>
          {contributions.map((contribution) => (
            <TableRow key={contribution.id}>
              <TableCell>
                {format(new Date(contribution.contribution_date), "MMM d, yyyy")}
              </TableCell>
              <TableCell>{formatMilkType(contribution.milk_type)}</TableCell>
              <TableCell>{contribution.quantity}</TableCell>
              <TableCell>₹{contribution.price_per_liter.toFixed(2)}</TableCell>
              <TableCell className="font-medium">₹{contribution.calculated_amount.toFixed(2)}</TableCell>
              <TableCell>
                {getQualityBadge(contribution.quality_rating)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
