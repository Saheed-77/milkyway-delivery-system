
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
import { Loader2 } from "lucide-react";

interface Contribution {
  id: string;
  quantity: number;
  milk_type: string;
  contribution_date: string;
  quality_rating: number | null;
  created_at: string;
}

export const ContributionHistory = () => {
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContributions = async () => {
      try {
        const { data, error } = await supabase
          .from("milk_contributions")
          .select("*")
          .order("contribution_date", { ascending: false })
          .limit(10);

        if (error) throw error;
        setContributions(data || []);
      } catch (error) {
        console.error("Error fetching contribution history:", error);
        toast({
          title: "Error",
          description: "Failed to load your contribution history.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchContributions();
  }, []);

  // Format milk type for display
  const formatMilkType = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Milk Contributions</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : contributions.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Quantity (L)</TableHead>
                <TableHead>Quality Rating</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contributions.map((contribution) => (
                <TableRow key={contribution.id}>
                  <TableCell>
                    {format(new Date(contribution.contribution_date), "PPP")}
                  </TableCell>
                  <TableCell>{formatMilkType(contribution.milk_type)}</TableCell>
                  <TableCell>{contribution.quantity}</TableCell>
                  <TableCell>
                    {contribution.quality_rating 
                      ? `${contribution.quality_rating}/10` 
                      : "Pending"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-muted-foreground text-center py-8">
            No contributions recorded yet. Start by submitting your first milk contribution.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
