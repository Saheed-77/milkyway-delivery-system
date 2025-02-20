
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

interface MilkContribution {
  id: string;
  quantity: number;
  milk_type: string;
  contribution_date: string;
  quality_rating: number | null;
  created_at: string;
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
        const { data, error } = await supabase
          .from("milk_contributions")
          .select("*")
          .eq("farmer_id", farmerId)
          .order("contribution_date", { ascending: false })
          .limit(10);

        if (error) throw error;
        setContributions(data || []);
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
        No contributions recorded yet. Start by adding your first contribution!
      </div>
    );
  }

  const formatMilkType = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Milk Type</TableHead>
            <TableHead>Quantity (L)</TableHead>
            <TableHead>Quality Rating</TableHead>
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
              <TableCell>
                {contribution.quality_rating ? `${contribution.quality_rating}/10` : "Pending"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
