
import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Card, 
  CardContent
} from "@/components/ui/card";
import { Package, Truck, CheckCircle, Calendar } from "lucide-react";

export const DeliverySummary = () => {
  const [stats, setStats] = useState({
    pendingDeliveries: 0,
    completedToday: 0,
    totalCompleted: 0,
    upcomingScheduled: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchDeliveryStats();
  }, []);

  const fetchDeliveryStats = async () => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("Not authenticated");
      }

      // Get pending deliveries count
      const { count: pendingCount, error: pendingError } = await supabase
        .from("orders")
        .select("id", { count: "exact" })
        .eq("status", "pending");

      if (pendingError) throw pendingError;

      // Get deliveries completed today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { count: todayCount, error: todayError } = await supabase
        .from("orders")
        .select("id", { count: "exact" })
        .eq("status", "delivered")
        .gte("updated_at", today.toISOString());

      if (todayError) throw todayError;

      // Get total completed deliveries
      const { count: totalCompletedCount, error: totalCompletedError } = await supabase
        .from("orders")
        .select("id", { count: "exact" })
        .eq("status", "delivered");

      if (totalCompletedError) throw totalCompletedError;

      // Get upcoming scheduled deliveries
      const { count: upcomingCount, error: upcomingError } = await supabase
        .from("orders")
        .select("id", { count: "exact" })
        .eq("status", "pending")
        .not("delivery_slot", "is", null);

      if (upcomingError) throw upcomingError;

      setStats({
        pendingDeliveries: pendingCount || 0,
        completedToday: todayCount || 0,
        totalCompleted: totalCompletedCount || 0,
        upcomingScheduled: upcomingCount || 0
      });
    } catch (error) {
      console.error("Error fetching delivery stats:", error);
      toast({
        title: "Error",
        description: "Failed to load delivery statistics",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const StatCard = ({ icon: Icon, title, value, className }) => (
    <Card className={`${className}`}>
      <CardContent className="flex items-center p-6">
        <div className="rounded-full bg-opacity-10 p-3 mr-4" style={{ backgroundColor: `${className}25` }}>
          <Icon className={`h-8 w-8 ${className}`} />
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <h3 className="text-2xl font-bold">{isLoading ? "..." : value}</h3>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard 
        icon={Package} 
        title="Pending Deliveries" 
        value={stats.pendingDeliveries}
        className="text-amber-500"
      />
      <StatCard 
        icon={Truck} 
        title="Completed Today" 
        value={stats.completedToday}
        className="text-green-500"
      />
      <StatCard 
        icon={CheckCircle} 
        title="Total Completed" 
        value={stats.totalCompleted}
        className="text-blue-500"
      />
      <StatCard 
        icon={Calendar} 
        title="Scheduled Deliveries" 
        value={stats.upcomingScheduled}
        className="text-purple-500"
      />
    </div>
  );
};
