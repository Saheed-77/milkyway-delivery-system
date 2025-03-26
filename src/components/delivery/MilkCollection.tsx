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

export const MilkCollection = () => {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchCollections();
  }, []);

  const fetchCollections = async () => {
    try {
      // Fixed table name to milk_contributions instead of milk_collections
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
    <div>
      Milk Collection Component
    </div>
  );
};
