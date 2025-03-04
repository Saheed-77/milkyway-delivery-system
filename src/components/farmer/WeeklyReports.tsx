
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  startOfWeek, 
  endOfWeek, 
  subWeeks, 
  format, 
  eachDayOfInterval, 
  isSameDay 
} from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

interface WeekData {
  date: string;
  quantity: number;
  earnings: number;
}

interface WeeklyReportsProps {
  farmerId?: string;
}

export const WeeklyReports = ({ farmerId }: WeeklyReportsProps) => {
  const { toast } = useToast();
  const [currentWeekData, setCurrentWeekData] = useState<WeekData[]>([]);
  const [lastWeekData, setLastWeekData] = useState<WeekData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [weeklyTotals, setWeeklyTotals] = useState({
    currentWeek: { quantity: 0, earnings: 0 },
    lastWeek: { quantity: 0, earnings: 0 },
  });

  useEffect(() => {
    if (!farmerId) return;

    const fetchWeeklyData = async () => {
      setIsLoading(true);
      try {
        const today = new Date();
        const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });
        const currentWeekEnd = endOfWeek(today, { weekStartsOn: 1 });
        const lastWeekStart = startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });
        const lastWeekEnd = endOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });

        // Fetch current week contributions
        const { data: currentWeekContributions, error: currentWeekError } = await supabase
          .from("milk_contributions")
          .select(`
            *,
            milk_pricing!inner(price_per_liter)
          `)
          .eq("farmer_id", farmerId)
          .gte("contribution_date", currentWeekStart.toISOString())
          .lte("contribution_date", currentWeekEnd.toISOString())
          .order("contribution_date", { ascending: true });

        if (currentWeekError) throw currentWeekError;

        // Fetch last week contributions
        const { data: lastWeekContributions, error: lastWeekError } = await supabase
          .from("milk_contributions")
          .select(`
            *,
            milk_pricing!inner(price_per_liter)
          `)
          .eq("farmer_id", farmerId)
          .gte("contribution_date", lastWeekStart.toISOString())
          .lte("contribution_date", lastWeekEnd.toISOString())
          .order("contribution_date", { ascending: true });

        if (lastWeekError) throw lastWeekError;

        // Process current week data
        const currentWeekDays = eachDayOfInterval({
          start: currentWeekStart,
          end: currentWeekEnd
        });

        const currentWeekChartData = currentWeekDays.map(day => {
          const dayContributions = currentWeekContributions?.filter(
            c => isSameDay(new Date(c.contribution_date), day)
          ) || [];
          
          const totalQuantity = dayContributions.reduce((sum, contrib) => sum + contrib.quantity, 0);
          const totalEarnings = dayContributions.reduce(
            (sum, contrib) => sum + (contrib.quantity * contrib.milk_pricing.price_per_liter), 
            0
          );
          
          return {
            date: format(day, "EEE"),
            quantity: totalQuantity,
            earnings: totalEarnings
          };
        });

        // Process last week data
        const lastWeekDays = eachDayOfInterval({
          start: lastWeekStart,
          end: lastWeekEnd
        });

        const lastWeekChartData = lastWeekDays.map(day => {
          const dayContributions = lastWeekContributions?.filter(
            c => isSameDay(new Date(c.contribution_date), day)
          ) || [];
          
          const totalQuantity = dayContributions.reduce((sum, contrib) => sum + contrib.quantity, 0);
          const totalEarnings = dayContributions.reduce(
            (sum, contrib) => sum + (contrib.quantity * contrib.milk_pricing.price_per_liter), 
            0
          );
          
          return {
            date: format(day, "EEE"),
            quantity: totalQuantity,
            earnings: totalEarnings
          };
        });

        setCurrentWeekData(currentWeekChartData);
        setLastWeekData(lastWeekChartData);

        // Calculate weekly totals
        const currentWeekQuantity = currentWeekChartData.reduce((sum, day) => sum + day.quantity, 0);
        const currentWeekEarnings = currentWeekChartData.reduce((sum, day) => sum + day.earnings, 0);
        const lastWeekQuantity = lastWeekChartData.reduce((sum, day) => sum + day.quantity, 0);
        const lastWeekEarnings = lastWeekChartData.reduce((sum, day) => sum + day.earnings, 0);

        setWeeklyTotals({
          currentWeek: { quantity: currentWeekQuantity, earnings: currentWeekEarnings },
          lastWeek: { quantity: lastWeekQuantity, earnings: lastWeekEarnings }
        });

      } catch (error: any) {
        toast({
          title: "Error loading weekly reports",
          description: error.message || "Failed to load weekly report data.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchWeeklyData();
  }, [farmerId, toast]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-80 w-full" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  // Calculate percent changes
  const quantityChange = weeklyTotals.lastWeek.quantity === 0 
    ? 100 
    : ((weeklyTotals.currentWeek.quantity - weeklyTotals.lastWeek.quantity) / weeklyTotals.lastWeek.quantity) * 100;
  
  const earningsChange = weeklyTotals.lastWeek.earnings === 0 
    ? 100 
    : ((weeklyTotals.currentWeek.earnings - weeklyTotals.lastWeek.earnings) / weeklyTotals.lastWeek.earnings) * 100;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-medium mb-2">Weekly Production</h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold">{weeklyTotals.currentWeek.quantity.toFixed(1)} L</p>
                <p className="text-sm text-muted-foreground">This Week</p>
              </div>
              <div className={`text-sm ${quantityChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {quantityChange >= 0 ? '+' : ''}{quantityChange.toFixed(1)}%
                <p className="text-xs text-muted-foreground">vs Last Week</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-medium mb-2">Weekly Earnings</h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold">₹{weeklyTotals.currentWeek.earnings.toFixed(2)}</p>
                <p className="text-sm text-muted-foreground">This Week</p>
              </div>
              <div className={`text-sm ${earningsChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {earningsChange >= 0 ? '+' : ''}{earningsChange.toFixed(1)}%
                <p className="text-xs text-muted-foreground">vs Last Week</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="text-lg font-medium mb-4">Daily Production (This Week)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={currentWeekData}
            margin={{
              top: 5,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
            <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
            <Tooltip 
              formatter={(value, name) => {
                if (name === "earnings") return [`₹${Number(value).toFixed(2)}`, "Earnings"];
                if (name === "quantity") return [`${Number(value).toFixed(1)} L`, "Quantity"];
                return [value, name];
              }}
            />
            <Legend />
            <Bar yAxisId="left" dataKey="quantity" name="Liters" fill="#8884d8" />
            <Bar yAxisId="right" dataKey="earnings" name="Earnings (₹)" fill="#82ca9d" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div>
        <h3 className="text-lg font-medium mb-4">Daily Production (Last Week)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={lastWeekData}
            margin={{
              top: 5,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
            <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
            <Tooltip 
              formatter={(value, name) => {
                if (name === "earnings") return [`₹${Number(value).toFixed(2)}`, "Earnings"];
                if (name === "quantity") return [`${Number(value).toFixed(1)} L`, "Quantity"];
                return [value, name];
              }}
            />
            <Legend />
            <Bar yAxisId="left" dataKey="quantity" name="Liters" fill="#8884d8" />
            <Bar yAxisId="right" dataKey="earnings" name="Earnings (₹)" fill="#82ca9d" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
