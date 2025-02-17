
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const milkContributionSchema = z.object({
  quantity: z.coerce.number().positive("Quantity must be positive"),
  milk_type: z.string().min(1, "Please select a milk type"),
});

type MilkContributionFormValues = z.infer<typeof milkContributionSchema>;

export const MilkContributionForm = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<MilkContributionFormValues>({
    resolver: zodResolver(milkContributionSchema),
    defaultValues: {
      quantity: 0,
      milk_type: "cow",
    },
  });

  const onSubmit = async (data: MilkContributionFormValues) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("milk_contributions")
        .insert([{
          quantity: data.quantity,
          milk_type: data.milk_type,
          contribution_date: new Date().toISOString().split('T')[0],
        }]);

      if (error) throw error;

      toast({
        title: "Contribution Recorded",
        description: `Successfully recorded ${data.quantity} liters of ${data.milk_type} milk.`,
      });
      
      form.reset({
        quantity: 0,
        milk_type: "cow",
      });
    } catch (error) {
      console.error("Error recording milk contribution:", error);
      toast({
        title: "Error",
        description: "Failed to record your contribution. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Record Today's Milk Contribution</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity (Liters)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="Enter milk quantity"
                      step="0.1"
                      min="0"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="milk_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Milk Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select milk type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="cow">Cow Milk</SelectItem>
                      <SelectItem value="goat">Goat Milk</SelectItem>
                      <SelectItem value="buffalo">Buffalo Milk</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Contribution"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};
