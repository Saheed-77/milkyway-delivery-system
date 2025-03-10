import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line, LineChart } from 'recharts';
import { useToast } from "@/components/ui/use-toast";

interface MilkContribution {
  contribution_date: string;
  total_quantity: number;
}

interface FarmerRegistration {
  month: string;
  count: number;
}

interface DeliveryPerformance {
  delivery_person: string;
  completed: number;
  pending: number;
}

export const Reports = () => {
  const [contributionData, setContributionData] = useState<MilkContribution[]>([]);
  const [registrationData, setRegistrationData] = useState<FarmerRegistration[]>([]);
  const [deliveryData, setDeliveryData] = useState<DeliveryPerformance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchReportData = async () => {
      setIsLoading(true);
      try {
        // Fetch milk contributions data
        const { data: contributionsData, error: contributionsError } = await supabase
          .from('milk_contributions')
          .select('contribution_date, quantity')
          .order('contribution_date', { ascending: false })
          .limit(30);

        if (contributionsError) throw contributionsError;

        // Process contribution data
        const contributionByDate = contributionsData.reduce((acc, curr) => {
          const date = new Date(curr.contribution_date).toLocaleDateString();
          acc[date] = (acc[date] || 0) + Number(curr.quantity);
          return acc;
        }, {} as Record<string, number>);

        const processedContributionData = Object.entries(contributionByDate).map(([date, total_quantity]) => ({
          contribution_date: date,
          total_quantity: total_quantity as number,
        })).sort((a, b) => new Date(a.contribution_date).getTime() - new Date(b.contribution_date).getTime());

        setContributionData(processedContributionData);

        // Mock farmer registration data (replace with actual data when available)
        const mockRegistrationData = [
          { month: 'Jan', count: 5 },
          { month: 'Feb', count: 8 },
          { month: 'Mar', count: 12 },
          { month: 'Apr', count: 7 },
          { month: 'May', count: 11 },
          { month: 'Jun', count: 9 },
        ];
        setRegistrationData(mockRegistrationData);

        // Mock delivery performance data (replace with actual data when available)
        const mockDeliveryData = [
          { delivery_person: 'John D.', completed: 45, pending: 5 },
          { delivery_person: 'Sarah M.', completed: 38, pending: 3 },
          { delivery_person: 'Mike T.', completed: 42, pending: 7 },
          { delivery_person: 'Emma K.', completed: 50, pending: 2 },
        ];
        setDeliveryData(mockDeliveryData);

      } catch (error) {
        console.error('Error fetching report data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load report data',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchReportData();
  }, [toast]);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="milk" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="milk">Milk Contributions</TabsTrigger>
          <TabsTrigger value="farmers">Farmer Registrations</TabsTrigger>
          <TabsTrigger value="delivery">Delivery Performance</TabsTrigger>
        </TabsList>
        
        <TabsContent value="milk">
          <Card>
            <CardHeader>
              <CardTitle>Daily Milk Contributions</CardTitle>
              <CardDescription>Total milk collected over the last 30 days (in liters)</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p>Loading chart data...</p>
              ) : (
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={contributionData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="contribution_date"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="total_quantity" 
                      name="Milk Quantity (L)" 
                      stroke="#437358" 
                      activeDot={{ r: 8 }} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="farmers">
          <Card>
            <CardHeader>
              <CardTitle>Farmer Registrations</CardTitle>
              <CardDescription>New farmer registrations by month</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={registrationData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" name="New Farmers" fill="#437358" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="delivery">
          <Card>
            <CardHeader>
              <CardTitle>Delivery Performance</CardTitle>
              <CardDescription>Orders completed vs pending by delivery personnel</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={deliveryData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="delivery_person" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="completed" name="Completed Deliveries" fill="#437358" />
                  <Bar dataKey="pending" name="Pending Deliveries" fill="#d97706" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
