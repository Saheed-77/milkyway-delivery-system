
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { format, subDays, startOfDay } from "date-fns";
import { Loader2 } from "lucide-react";

interface DailyContribution {
  date: string;
  quantity: number;
}

export const FarmerStatsSummary = () => {
  const [dailyData, setDailyData] = useState<DailyContribution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDailyContributions = async () => {
      try {
        // Get contributions for the last 7 days
        const endDate = startOfDay(new Date());
        const startDate = subDays(endDate, 6);
        
        const { data, error } = await supabase
          .from("milk_contributions")
          .select("contribution_date, quantity")
          .gte("contribution_date", startDate.toISOString().split('T')[0])
          .lte("contribution_date", endDate.toISOString().split('T')[0])
          .order("contribution_date", { ascending: true });

        if (error) throw error;

        // Group and sum by date
        const groupedByDate = data?.reduce((acc, item) => {
          const date = item.contribution_date;
          if (!acc[date]) {
            acc[date] = 0;
          }
          acc[date] += item.quantity;
          return acc;
        }, {} as Record<string, number>) || {};

        // Fill in missing dates with zero values
        const resultData: DailyContribution[] = [];
        for (let i = 0; i < 7; i++) {
          const currentDate = subDays(endDate, 6 - i);
          const dateStr = currentDate.toISOString().split('T')[0];
          const formattedDate = format(currentDate, "MMM dd");
          
          resultData.push({
            date: formattedDate,
            quantity: groupedByDate[dateStr] || 0,
          });
        }

        setDailyData(resultData);
      } catch (error) {
        console.error("Error fetching daily contributions:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDailyContributions();
  }, []);

  const chartConfig = {
    milk: {
      label: "Milk (L)",
      theme: {
        light: "#4ade80",
        dark: "#4ade80",
      },
    },
  };

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="font-medium mb-4">Last 7 Days Contributions</h3>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="h-60">
            <ChartContainer config={chartConfig}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData}>
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar 
                    dataKey="quantity" 
                    name="Milk (L)" 
                    fill="var(--color-milk)" 
                    radius={[4, 4, 0, 0]} 
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
