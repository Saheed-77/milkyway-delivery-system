import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getWalletBalance, placeOrder } from "@/lib/rpc";
import { useToast } from "@/hooks/use-toast";

export const useOrderLogic = (onOrderComplete?: () => void) => {
  const [quantity, setQuantity] = useState("1");
  const [milkType, setMilkType] = useState("cow");
  const [paymentMethod, setPaymentMethod] = useState("wallet");
  const [isLoading, setIsLoading] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [estimatedCost, setEstimatedCost] = useState(0);
  const { toast } = useToast();

  const parsedQuantity = Number.parseInt(quantity, 10);
  const isQuantityValid =
    Number.isFinite(parsedQuantity) && parsedQuantity >= 1 && parsedQuantity <= 100;

  const insufficientFunds =
    paymentMethod === "wallet" && estimatedCost > 0 && walletBalance < estimatedCost;

  const fetchWalletBalance = useCallback(async () => {
    try {
      const balance = await getWalletBalance();
      setWalletBalance(balance ?? 0);
    } catch (error) {
      console.error("Error fetching wallet balance:", error);
    }
  }, []);

  const estimateOrderCost = useCallback(async () => {
    if (!isQuantityValid) {
      setEstimatedCost(0);
      return;
    }
    try {
      const { data: products, error } = await supabase
        .from("products")
        .select("price")
        .eq("milk_type", milkType)
        .order("price")
        .limit(1);

      if (error || !products || products.length === 0) {
        setEstimatedCost(0);
        return;
      }
      setEstimatedCost(products[0].price * parsedQuantity);
    } catch (error) {
      console.error("Error estimating cost:", error);
      setEstimatedCost(0);
    }
  }, [milkType, parsedQuantity, isQuantityValid]);

  useEffect(() => {
    void fetchWalletBalance();
  }, [fetchWalletBalance]);

  useEffect(() => {
    void estimateOrderCost();
  }, [estimateOrderCost]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isQuantityValid) {
      toast({
        title: "Invalid quantity",
        description: "Quantity must be between 1 and 100.",
        variant: "destructive",
      });
      return;
    }
    if (paymentMethod !== "wallet" && paymentMethod !== "cash") {
      toast({
        title: "Invalid payment method",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await placeOrder({
        milkType,
        quantity: parsedQuantity,
        paymentMethod,
      });

      toast({
        title: "Order Placed!",
        description: `Your order for ${parsedQuantity} unit(s) of ${milkType} milk has been submitted with ${
          paymentMethod === "wallet" ? "wallet payment" : "cash on delivery"
        }.`,
      });

      setQuantity("1");
      setMilkType("cow");
      await fetchWalletBalance();
      onOrderComplete?.();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "There was an error placing your order. Please try again.";
      toast({ title: "Order Failed", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    quantity,
    setQuantity,
    milkType,
    setMilkType,
    paymentMethod,
    setPaymentMethod,
    isLoading,
    walletBalance,
    estimatedCost,
    insufficientFunds,
    handleSubmit,
  };
};
