import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Loader2,
  Lock,
  QrCode,
  ShieldCheck,
  Smartphone,
  Wallet,
  XCircle,
} from "lucide-react";
import { LogoMark } from "@/components/common/Brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage } from "@/hooks/api/core";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { api, type CapturePaymentInput, type GatewayMethod, type GatewayOrder, type GatewayPayment } from "@/services";
import { DemoQr } from "./DemoQr";
import {
  BANKS,
  cardDeclined,
  cardNetwork,
  expiryValid,
  formatCardNumber,
  formatExpiry,
  luhnValid,
  maskedCard,
  TEST_CARDS,
  TEST_UPI,
  upiValid,
  WALLETS,
} from "./paymentUtils";

type Stage =
  | { kind: "form" }
  | { kind: "bank"; bank: string }
  | { kind: "processing"; label: string }
  | { kind: "success"; payment: GatewayPayment }
  | { kind: "failed"; reason: string };

interface CheckoutProps {
  order: GatewayOrder;
  description: string;
  onSuccess: (payment: GatewayPayment) => void;
  onClose: () => void;
  onRetry: () => void;
}

const METHODS: { id: GatewayMethod; label: string; hint: string; icon: typeof QrCode }[] = [
  { id: "upi", label: "UPI", hint: "GPay, PhonePe, Paytm & more", icon: Smartphone },
  { id: "card", label: "Cards", hint: "Visa, Mastercard, RuPay", icon: CreditCard },
  { id: "netbanking", label: "Netbanking", hint: "All major banks", icon: Building2 },
  { id: "wallet", label: "Wallets", hint: "Paytm, PhonePe, Amazon Pay", icon: Wallet },
];

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Razorpay-style checkout running in test mode. Every method can be driven to
 * success or failure so the full flow — including declines and retries — can be
 * demoed without a merchant account or real money.
 */
export function RazorpayCheckout({ order, description, onSuccess, onClose, onRetry }: CheckoutProps) {
  const [method, setMethod] = useState<GatewayMethod>("upi");
  const [stage, setStage] = useState<Stage>({ kind: "form" });

  const settle = async (input: CapturePaymentInput, ok: boolean, reason = "Payment declined") => {
    setStage({ kind: "processing", label: input.method === "upi" ? "Waiting for UPI confirmation…" : "Processing payment securely…" });
    await wait(1400);
    try {
      if (ok) {
        const payment = await api.gateway.capture(order.id, input);
        setStage({ kind: "success", payment });
        await wait(1100);
        onSuccess(payment);
      } else {
        await api.gateway.fail(order.id, { ...input, reason });
        setStage({ kind: "failed", reason });
      }
    } catch (e) {
      setStage({ kind: "failed", reason: errorMessage(e) });
    }
  };

  const busy = stage.kind === "processing" || stage.kind === "success";

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent
        className="gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[440px] max-sm:bottom-0 max-sm:top-auto max-sm:max-h-[92svh] max-sm:translate-y-0 max-sm:rounded-b-none max-sm:data-[state=open]:slide-in-from-bottom"
        onInteractOutside={(e) => busy && e.preventDefault()}
      >
        {/* header */}
        <div className="flex items-start gap-3 bg-[hsl(222_47%_16%)] px-5 pb-4 pt-5 text-white">
          <LogoMark className="h-10 w-10" />
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-base font-semibold text-white">MilkyWay</DialogTitle>
            <DialogDescription className="truncate text-xs text-white/70">{description}</DialogDescription>
            <p className="mt-1 text-2xl font-extrabold tabular-nums">{formatCurrency(order.amount)}</p>
          </div>
          <Badge className="border-0 bg-warning text-warning-foreground hover:bg-warning">TEST MODE</Badge>
        </div>

        <div className="max-h-[70svh] overflow-y-auto">
          {stage.kind === "processing" && (
            <Centered>
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="font-semibold">{stage.label}</p>
              <p className="text-xs text-muted-foreground">Don't close this window.</p>
            </Centered>
          )}
          {stage.kind === "success" && (
            <Centered>
              <CheckCircle2 className="h-14 w-14 text-success" />
              <p className="text-lg font-bold">Payment successful</p>
              <p className="text-sm text-muted-foreground">
                {stage.payment.method_detail} · <span className="font-mono">{stage.payment.id}</span>
              </p>
            </Centered>
          )}
          {stage.kind === "failed" && (
            <Centered>
              <XCircle className="h-14 w-14 text-destructive" />
              <p className="text-lg font-bold">Payment failed</p>
              <p className="max-w-xs text-sm text-muted-foreground">{stage.reason}. No money was taken.</p>
              <div className="mt-2 flex gap-2">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button onClick={onRetry}>Try again</Button>
              </div>
            </Centered>
          )}
          {stage.kind === "bank" && (
            <div className="space-y-4 p-5">
              <button className="flex items-center gap-1 text-sm font-medium text-muted-foreground" onClick={() => setStage({ kind: "form" })}>
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <div className="rounded-xl border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Simulated bank page</p>
                <p className="mt-1 text-lg font-bold">{stage.bank}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Authorise a payment of <strong>{formatCurrency(order.amount)}</strong> to MilkyWay.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => settle({ method: "netbanking", detail: stage.bank }, false, "Transaction declined by the bank")}>
                  Failure
                </Button>
                <Button variant="success" onClick={() => settle({ method: "netbanking", detail: stage.bank }, true)}>
                  Success
                </Button>
              </div>
            </div>
          )}
          {stage.kind === "form" && (
            <div className="grid sm:grid-cols-[140px_1fr]">
              <nav className="flex gap-1 overflow-x-auto border-b bg-muted/50 p-2 sm:flex-col sm:border-b-0 sm:border-r" aria-label="Payment methods">
                {METHODS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMethod(m.id)}
                    className={cn(
                      "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
                      method === m.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                    aria-pressed={method === m.id}
                  >
                    <m.icon className="h-4 w-4" /> {m.label}
                  </button>
                ))}
              </nav>
              <div className="p-5">
                {method === "upi" && <UpiForm order={order} onSettle={settle} />}
                {method === "card" && <CardForm amount={order.amount} onSettle={settle} />}
                {method === "netbanking" && (
                  <OptionList items={BANKS} icon={Building2} onPick={(bank) => setStage({ kind: "bank", bank })} />
                )}
                {method === "wallet" && (
                  <OptionList items={WALLETS} icon={Wallet} onPick={(w) => settle({ method: "wallet", detail: w }, true)} />
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-1.5 border-t bg-muted/40 py-2.5 text-[11px] text-muted-foreground">
          <Lock className="h-3 w-3" /> Secured checkout · simulated in test mode · <span className="font-mono">{order.id}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="flex min-h-[260px] flex-col items-center justify-center gap-2 p-8 text-center">{children}</div>;
}

function OptionList({ items, icon: Icon, onPick }: { items: string[]; icon: typeof Wallet; onPick: (v: string) => void }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li key={item}>
          <button
            onClick={() => onPick(item)}
            className="flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-colors hover:border-primary hover:bg-primary-soft/40"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-secondary">
              <Icon className="h-4 w-4" />
            </span>
            <span className="flex-1">{item}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </li>
      ))}
    </ul>
  );
}

function UpiForm({ order, onSettle }: { order: GatewayOrder; onSettle: (i: CapturePaymentInput, ok: boolean, reason?: string) => void }) {
  const [vpa, setVpa] = useState("");
  const [seconds, setSeconds] = useState(300);
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  const valid = upiValid(vpa);

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center">
        <DemoQr seed={`MILKYWAY-DEMO:${order.id}`} />
        <p className="text-sm font-semibold">Scan with any UPI app</p>
        <p className="text-xs text-muted-foreground">
          Demo QR — not a real UPI code · expires in {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
        </p>
        <div className="mt-1 grid w-full grid-cols-2 gap-2">
          <Button size="sm" variant="outline" onClick={() => onSettle({ method: "upi", detail: "UPI · QR scan" }, false, "UPI transaction declined")}>
            Simulate decline
          </Button>
          <Button size="sm" variant="success" disabled={seconds === 0} onClick={() => onSettle({ method: "upi", detail: "UPI · QR scan" }, true)}>
            Simulate paid
          </Button>
        </div>
      </div>
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          const id = vpa.trim().toLowerCase();
          onSettle({ method: "upi", detail: `UPI · ${id}` }, id !== TEST_UPI.failure, "UPI collect request declined");
        }}
      >
        <Label htmlFor="vpa">Or pay with UPI ID</Label>
        <div className="flex gap-2">
          <Input id="vpa" value={vpa} onChange={(e) => setVpa(e.target.value)} placeholder="yourname@okhdfc" autoComplete="off" />
          <Button type="submit" disabled={!valid}>
            Pay
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Test: <code>{TEST_UPI.success}</code> succeeds, <code>{TEST_UPI.failure}</code> fails.
        </p>
      </form>
    </div>
  );
}

function CardForm({ amount, onSettle }: { amount: number; onSettle: (i: CapturePaymentInput, ok: boolean, reason?: string) => void }) {
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [name, setName] = useState("");
  const amex = cardNetwork(number) === "Amex";
  const errors = {
    number: number && !luhnValid(number) ? "Enter a valid card number" : null,
    expiry: expiry.length === 5 && !expiryValid(expiry) ? "Card has expired or date is invalid" : null,
  };
  const valid = luhnValid(number) && expiryValid(expiry) && cvv.length === (amex ? 4 : 3) && name.trim().length > 1;

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        // only the network + last 4 digits ever leave this form
        onSettle({ method: "card", detail: maskedCard(number) }, !cardDeclined(number), "Card declined by issuing bank");
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="cc">Card number</Label>
        <div className="relative">
          <Input
            id="cc"
            inputMode="numeric"
            autoComplete="cc-number"
            value={number}
            onChange={(e) => setNumber(formatCardNumber(e.target.value))}
            placeholder="4111 1111 1111 1111"
            aria-invalid={!!errors.number}
            className="pr-24 font-mono"
          />
          {number && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">{cardNetwork(number)}</span>}
        </div>
        {errors.number && <p className="text-xs text-destructive">{errors.number}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="exp">Expiry</Label>
          <Input id="exp" inputMode="numeric" autoComplete="cc-exp" value={expiry} onChange={(e) => setExpiry(formatExpiry(e.target.value))} placeholder="MM/YY" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cvv">CVV</Label>
          <Input
            id="cvv"
            type="password"
            inputMode="numeric"
            autoComplete="cc-csc"
            value={cvv}
            onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, amex ? 4 : 3))}
            placeholder={amex ? "••••" : "•••"}
          />
        </div>
      </div>
      {errors.expiry && <p className="text-xs text-destructive">{errors.expiry}</p>}
      <div className="space-y-1.5">
        <Label htmlFor="ccname">Name on card</Label>
        <Input id="ccname" autoComplete="cc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Priya Raman" />
      </div>
      <Button type="submit" className="w-full" disabled={!valid}>
        <ShieldCheck /> Pay {formatCurrency(amount)}
      </Button>
      <p className="text-[11px] text-muted-foreground">
        Test cards: <code>{TEST_CARDS.success}</code> succeeds, <code>{TEST_CARDS.decline}</code> is declined. Any future expiry and CVV.
      </p>
    </form>
  );
}
