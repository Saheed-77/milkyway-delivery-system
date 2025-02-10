
import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreditCard, PlusCircle, Banknote } from "lucide-react";

export const WalletBalance = () => {
  const [balance, setBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [rechargeAmount, setRechargeAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchWalletBalance = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Get all wallet transactions for the user
        const { data, error } = await supabase
          .from("wallet_transactions")
          .select("amount, transaction_type, status")
          .eq("user_id", session.user.id)
          .eq("status", "completed");

        if (error) throw error;

        // Calculate balance from transactions
        const calculatedBalance = data?.reduce((total, transaction) => {
          if (transaction.transaction_type === "deposit") {
            return total + transaction.amount;
          } else if (transaction.transaction_type === "withdrawal") {
            return total - transaction.amount;
          }
          return total;
        }, 0) || 0;

        setBalance(calculatedBalance);
      } catch (error) {
        console.error("Error fetching wallet balance:", error);
        toast({
          title: "Error",
          description: "Failed to load your wallet balance. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchWalletBalance();
  }, [toast]);

  const handleRecharge = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    
    try {
      const amount = parseFloat(rechargeAmount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error("Please enter a valid amount");
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("You must be logged in to recharge your wallet");
      }

      // In a real app, you would integrate with a payment gateway here
      // For demo purposes, we'll just add the amount directly
      
      const { error } = await supabase
        .from("wallet_transactions")
        .insert({
          user_id: session.user.id,
          amount: amount,
          transaction_type: "deposit",
          status: "completed" // In real app, would be pending until payment confirmed
        });

      if (error) throw error;

      // Update local balance
      setBalance(prevBalance => prevBalance + amount);
      setRechargeAmount("");
      
      toast({
        title: "Wallet Recharged!",
        description: `Successfully added $${amount.toFixed(2)} to your wallet.`,
      });
    } catch (error) {
      console.error("Error recharging wallet:", error);
      toast({
        title: "Recharge Failed",
        description: error.message || "There was an error recharging your wallet. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Wallet Balance</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Loading balance...</p>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4 p-3 bg-[#f2fcf6] rounded-md">
              <div className="flex items-center">
                <CreditCard className="h-6 w-6 mr-3 text-[#437358]" />
                <div>
                  <p className="text-sm text-muted-foreground">Available Balance</p>
                  <p className="text-2xl font-bold text-[#437358]">${balance.toFixed(2)}</p>
                </div>
              </div>
              <Banknote className="h-8 w-8 text-[#437358] opacity-30" />
            </div>
            
            <div className="mt-4">
              <form onSubmit={handleRecharge} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="recharge-amount">Recharge Amount</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="recharge-amount"
                      type="number"
                      placeholder="Enter amount"
                      min="1"
                      step="0.01"
                      value={rechargeAmount}
                      onChange={(e) => setRechargeAmount(e.target.value)}
                      className="flex-1"
                    />
                    <Button 
                      type="submit" 
                      className="bg-[#437358] hover:bg-[#345c46]"
                      disabled={isProcessing || !rechargeAmount}
                    >
                      <PlusCircle className="h-4 w-4 mr-1" />
                      {isProcessing ? "Processing..." : "Add Funds"}
                    </Button>
                  </div>
                </div>
              </form>
              
              <p className="text-xs text-muted-foreground mt-3">
                Use your wallet balance to quickly pay for orders and subscriptions.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
