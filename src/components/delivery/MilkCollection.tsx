import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Milk, Package, CheckCircle, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";

export const MilkCollection = ({ refreshTrigger = 0 }) => {
  const [collections, setCollections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchCollections();
  }, [refreshTrigger]);

  const fetchCollections = async () => {
    try {
      const { data, error } = await supabase
        .from("milk_collections")
        .select(`
          *,
          farmer:farmer_id (name, phone_number),
          delivery:delivery_id (name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCollections(data || []);
    } catch (error) {
      console.error("Error fetching milk collections:", error);
      toast({
        title: "Error",
        description: "Failed to load milk collections. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
          <Package className="h-3 w-3 mr-1" /> Pending
        </Badge>;
      case "collected":
        return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
          <CheckCircle className="h-3 w-3 mr-1" /> Collected
        </Badge>;
      case "cancelled":
        return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">
          <XCircle className="h-3 w-3 mr-1" /> Cancelled
        </Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return `${date.toLocaleDateString()} (${formatDistanceToNow(date, { addSuffix: true })})`;
    } catch (error) {
      return dateString;
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>
          <div className="flex items-center">
            <Milk className="h-5 w-5 mr-2 text-[#437358]" />
            Milk Collection
          </div>
        </CardTitle>
        <Button variant="outline" size="sm">
          Add Collection
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Loading milk collections...</p>
        ) : collections.length === 0 ? (
          <div className="text-center py-8">
            <Milk className="h-12 w-12 mx-auto text-muted-foreground opacity-20" />
            <p className="mt-2 text-muted-foreground">No milk collections found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Collection Date</TableHead>
                  <TableHead>Farmer</TableHead>
                  <TableHead>Quantity (L)</TableHead>
                  <TableHead>Delivery Person</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {collections.map((collection) => (
                  <TableRow key={collection.id}>
                    <TableCell className="font-medium">
                      {formatDate(collection.created_at)}
                    </TableCell>
                    <TableCell>{collection.farmer?.name}</TableCell>
                    <TableCell>{collection.quantity}</TableCell>
                    <TableCell>{collection.delivery?.name}</TableCell>
                    <TableCell>{getStatusBadge(collection.status)}</TableCell>
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
