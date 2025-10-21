import { Wallet } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { TransactionList } from "@/components/wallet/TransactionList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useWalletBalance } from "@/hooks/api/queries";
import { formatCurrency } from "@/lib/format";

export default function FarmerWallet() {
  const balance = useWalletBalance();
  return (
    <div className="space-y-6">
      <PageHeader title="Wallet" description="Approved milk payments are credited here." />
      <Card className="overflow-hidden border-0 bg-primary text-primary-foreground">
        <CardContent className="relative flex items-center justify-between p-6">
          <div className="bg-dots absolute inset-0 opacity-20" aria-hidden />
          <div className="relative">
            <p className="text-sm text-primary-foreground/80">Balance</p>
            {balance.isLoading ? (
              <Skeleton className="mt-2 h-10 w-40 bg-white/20" />
            ) : (
              <p className="text-4xl font-extrabold tabular-nums">{formatCurrency(balance.data)}</p>
            )}
          </div>
          <Wallet className="relative h-10 w-10 text-primary-foreground/60" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionList />
        </CardContent>
      </Card>
    </div>
  );
}
