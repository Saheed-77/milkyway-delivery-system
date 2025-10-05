import { useState, type ReactNode } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useCompleteDelivery } from "@/hooks/api/queries";
import { formatCurrency } from "@/lib/format";
import type { Order } from "@/services";

/** Proof of delivery: the rider enters the 4-digit code the customer sees in their app. */
export function CompleteDeliveryDialog({ order, trigger }: { order: Order; trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [otp, setOtp] = useState("");
  const complete = useCompleteDelivery();

  const submit = () =>
    complete.mutate(
      { orderId: order.id, otp },
      {
        onSuccess: () => {
          setOpen(false);
          setOtp("");
        },
        onError: () => setOtp(""),
      }
    );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" /> Confirm delivery
          </DialogTitle>
          <DialogDescription>
            Ask {order.customer_name.split(" ")[0]} for the 4-digit code shown in their MilkyWay app.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 py-2">
          <InputOTP maxLength={4} value={otp} onChange={setOtp} onComplete={submit} autoFocus inputMode="numeric" pattern="^[0-9]*$">
            <InputOTPGroup>
              {[0, 1, 2, 3].map((i) => (
                <InputOTPSlot key={i} index={i} className="h-14 w-12 text-2xl font-bold" />
              ))}
            </InputOTPGroup>
          </InputOTP>
          {order.payment_method === "cash" && (
            <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm">
              Collect <strong>{formatCurrency(order.total_amount)}</strong> in cash.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button className="w-full" size="lg" disabled={otp.length !== 4 || complete.isPending} onClick={submit}>
            {complete.isPending && <Loader2 className="animate-spin" />}
            Mark delivered
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
