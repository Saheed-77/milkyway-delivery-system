import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { invalidateTopics, errorMessage } from "@/hooks/api/core";
import { api, type GatewayOrder, type GatewayPayment, type GatewayPurpose } from "@/services";
import { RazorpayCheckout } from "./RazorpayCheckout";

export class PaymentCancelledError extends Error {
  constructor() {
    super("Payment cancelled");
  }
}

interface PayOptions {
  amount: number;
  purpose: GatewayPurpose;
  description: string;
}

type Pay = (opts: PayOptions) => Promise<GatewayPayment>;

const PaymentContext = createContext<Pay | null>(null);

interface Session {
  order: GatewayOrder;
  opts: PayOptions;
  resolve: (p: GatewayPayment) => void;
  reject: (e: Error) => void;
}

/**
 * Opens the (simulated) Razorpay checkout. `pay()` creates a gateway order,
 * shows the sheet, and resolves with the captured payment — or rejects with
 * PaymentCancelledError when the customer closes it.
 */
export function PaymentProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [attempt, setAttempt] = useState(0);
  const sessionRef = useRef<Session | null>(null);
  const qc = useQueryClient();

  const open = useCallback(async (opts: PayOptions, resolve: Session["resolve"], reject: Session["reject"]) => {
    try {
      const order = await api.gateway.createOrder({ amount: opts.amount, purpose: opts.purpose });
      const next = { order, opts, resolve, reject };
      sessionRef.current = next;
      setSession(next);
      setAttempt((a) => a + 1);
    } catch (e) {
      toast.error(errorMessage(e));
      reject(e instanceof Error ? e : new Error(errorMessage(e)));
    }
  }, []);

  const pay = useCallback<Pay>(
    (opts) => new Promise<GatewayPayment>((resolve, reject) => void open(opts, resolve, reject)),
    [open]
  );

  const close = () => {
    sessionRef.current?.reject(new PaymentCancelledError());
    sessionRef.current = null;
    setSession(null);
    invalidateTopics(qc, ["gateway"]);
  };

  return (
    <PaymentContext.Provider value={pay}>
      {children}
      {session && (
        <RazorpayCheckout
          key={`${session.order.id}-${attempt}`}
          order={session.order}
          description={session.opts.description}
          onSuccess={(payment) => {
            session.resolve(payment);
            sessionRef.current = null;
            setSession(null);
            invalidateTopics(qc, ["gateway", "wallet"]);
          }}
          onClose={close}
          // a failed gateway order is final (like Razorpay); retry opens a fresh one
          onRetry={() => {
            const { opts, resolve, reject } = session;
            setSession(null);
            void open(opts, resolve, reject);
          }}
        />
      )}
    </PaymentContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePayment(): Pay {
  const ctx = useContext(PaymentContext);
  if (!ctx) throw new Error("usePayment must be used inside <PaymentProvider>");
  return ctx;
}
