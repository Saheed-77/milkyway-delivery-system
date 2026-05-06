import { useState } from "react";
import { Building2, CreditCard, Loader2, ShieldCheck, Smartphone, Wallet } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { GatewayPaymentList } from "@/components/payments/GatewayPaymentList";
import { PaymentCancelledError, usePayment } from "@/components/payments/PaymentProvider";
import { TransactionList } from "@/components/wallet/TransactionList";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { errorMessage } from "@/hooks/api/core";
import { useWalletBalance } from "@/hooks/api/queries";
import { formatCurrency } from "@/lib/format";

const QUICK = [200, 500, 1000, 2000];

export default function WalletPage() {
  const { isDemo } = useAuth();
  const balance = useWalletBalance();
  const pay = usePayment();
  const [paying, setPaying] = useState(false);
  const [amount, setAmount] = useState("");
  const value = Number(amount);
  const valid = value >= 1 && value <= 100000;

  // Top-ups go through the payment gateway; the server credits the wallet on capture.
  const addMoney = async () => {
    if (!valid) return;
    setPaying(true);
    try {
      const payment = await pay({ amount: value, purpose: "wallet_topup", description: "Add money to MilkyWay wallet" });
      toast.success(`${formatCurrency(payment.amount)} added via ${payment.method_detail}`);
      setAmount("");
    } catch (e) {
      if (!(e instanceof PaymentCancelledError)) toast.error(errorMessage(e));
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Wallet" description="Pay for orders and subscriptions in one tap. Refunds land here instantly." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
        <div className="space-y-4">
          <Card className="overflow-hidden border-0 bg-primary text-primary-foreground">
            <CardContent className="relative p-6">
              <div className="bg-dots absolute inset-0 opacity-20" aria-hidden />
              <div className="relative space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-primary-foreground/80">Available balance</span>
                  <Wallet className="h-5 w-5 text-primary-foreground/80" />
                </div>
                {balance.isLoading ? (
                  <Skeleton className="h-10 w-40 bg-white/20" />
                ) : (
                  <p className="text-4xl font-extrabold tabular-nums">{formatCurrency(balance.data)}</p>
                )}
                <p className="text-xs text-primary-foreground/70">MilkyWay wallet · INR</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Add money</CardTitle>
              <CardDescription>
                Pay by UPI, card, netbanking or wallet.{" "}
                {isDemo ? "Test mode — no real money moves." : "Limit ₹1,00,000 per top-up."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void addMoney();
                }}
              >
                <div className="grid grid-cols-4 gap-2">
                  {QUICK.map((q) => (
                    <Button key={q} type="button" variant={value === q ? "soft" : "outline"} size="sm" onClick={() => setAmount(String(q))}>
                      ₹{q.toLocaleString("en-IN")}
                    </Button>
                  ))}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="amount">Amount</Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                    <Input
                      id="amount"
                      type="number"
                      inputMode="decimal"
                      min={1}
                      max={100000}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="pl-7 text-lg font-semibold"
                      placeholder="0"
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={!valid || paying}>
                  {paying && <Loader2 className="animate-spin" />}
                  Add {valid ? formatCurrency(value) : "money"}
                </Button>
                <div className="flex items-center justify-center gap-3 text-muted-foreground" aria-label="Accepted: UPI, cards, netbanking, wallets">
                  <Smartphone className="h-4 w-4" />
                  <CreditCard className="h-4 w-4" />
                  <Building2 className="h-4 w-4" />
                  <Wallet className="h-4 w-4" />
                </div>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5" /> The wallet is credited by the server only after the payment is captured.
                </p>
              </form>
            </CardContent>
          </Card>
        </div>

        <Card>
          <Tabs defaultValue="wallet">
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
              <CardTitle>History</CardTitle>
              <TabsList>
                <TabsTrigger value="wallet">Wallet</TabsTrigger>
                <TabsTrigger value="online">Online payments</TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent>
              <TabsContent value="wallet" className="mt-0">
                <TransactionList />
              </TabsContent>
              <TabsContent value="online" className="mt-0">
                <GatewayPaymentList />
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
