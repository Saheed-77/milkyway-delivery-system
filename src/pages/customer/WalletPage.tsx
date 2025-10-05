import { useState } from "react";
import { Loader2, ShieldCheck, Wallet } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { TransactionList } from "@/components/wallet/TransactionList";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useRecharge, useWalletBalance } from "@/hooks/api/queries";
import { formatCurrency } from "@/lib/format";

const QUICK = [200, 500, 1000, 2000];

export default function WalletPage() {
  const { isDemo } = useAuth();
  const balance = useWalletBalance();
  const recharge = useRecharge();
  const [amount, setAmount] = useState("");
  const value = Number(amount);
  const valid = value > 0 && value <= 100000;

  return (
    <div className="space-y-6">
      <PageHeader title="Wallet" description="Pay for orders and subscriptions in one tap. Refunds land here instantly." />
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
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
                {isDemo ? "Demo top-up — no real payment is taken." : "Top up instantly. Limit ₹1,00,000 per recharge."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (valid) recharge.mutate(value, { onSuccess: () => setAmount("") });
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
                <Button type="submit" className="w-full" disabled={!valid || recharge.isPending}>
                  {recharge.isPending && <Loader2 className="animate-spin" />}
                  Add {valid ? formatCurrency(value) : "money"}
                </Button>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5" /> Balances are computed on the server; the app can't edit them.
                </p>
              </form>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <TransactionList />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
