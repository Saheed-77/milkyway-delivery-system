
import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Check, ChevronDown, Beaker, Milk } from "lucide-react";

export const MilkCollection = () => {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchCollections();
  }, []);

  const fetchCollections = async () => {
    try {
      // Fixed to use milk_contributions table
      const { data, error } = await supabase
        .from("milk_contributions")
        .select(`
          *,
          farmer:profiles!farmer_id (
            email,
            first_name,
            last_name
          )
        `)
        .order("contribution_date", { ascending: false });

      if (error) throw error;
      setCollections(data || []);
    } catch (error) {
      console.error("Error fetching collections:", error);
      toast({
        title: "Error",
        description: "Failed to load milk collections.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Milk className="h-5 w-5 mr-2 text-[#437358]" />
          Milk Collections
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-center py-4">Loading milk collections...</p>
        ) : collections.length === 0 ? (
          <p className="text-center py-4 text-muted-foreground">No milk collections found</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Farmer</TableHead>
                  <TableHead>Milk Type</TableHead>
                  <TableHead>Quantity (L)</TableHead>
                  <TableHead>Quality Rating</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {collections.map((collection) => (
                  <TableRow key={collection.id}>
                    <TableCell>
                      {format(new Date(collection.contribution_date), "MMM dd, yyyy")}
                    </TableCell>
                    <TableCell>
                      {collection.farmer?.first_name 
                        ? `${collection.farmer.first_name} ${collection.farmer.last_name}`
                        : collection.farmer?.email || "Unknown"}
                    </TableCell>
                    <TableCell className="capitalize">{collection.milk_type}</TableCell>
                    <TableCell>{collection.quantity}</TableCell>
                    <TableCell>
                      {collection.quality_rating 
                        ? `${collection.quality_rating}/5` 
                        : "Not rated"}
                    </TableCell>
                    <TableCell className="text-right">
                      ₹{collection.price?.toFixed(2) || '0.00'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
