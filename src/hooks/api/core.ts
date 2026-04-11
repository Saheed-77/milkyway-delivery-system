import { useEffect } from "react";
import {
  useMutation,
  useQueryClient,
  type QueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { api, type ChangeTopic } from "@/services";

/**
 * Query keys start with a "family" so a data change can invalidate every
 * query that depends on it (see TOPIC_FAMILIES).
 */
export type Family =
  | "orders"
  | "tracking"
  | "stops"
  | "wallet"
  | "stock"
  | "farmers"
  | "payments"
  | "contributions"
  | "subscriptions"
  | "pricing"
  | "products"
  | "riders"
  | "reports"
  | "notifications"
  | "gateway"
  | "slots";

const TOPIC_FAMILIES: Record<ChangeTopic, Family[]> = {
  orders: ["orders", "tracking", "stops", "riders", "reports", "notifications", "stock", "slots", "gateway"],
  wallet: ["wallet"],
  stock: ["stock"],
  farmers: ["farmers", "notifications"],
  payments: ["payments", "contributions", "notifications"],
  contributions: ["contributions", "stock", "payments", "reports"],
  subscriptions: ["subscriptions", "stock"],
  pricing: ["pricing", "products", "contributions"],
  rider_locations: ["riders", "tracking"],
  gateway: ["gateway", "wallet"],
  slots: ["slots"],
};

export function invalidateTopics(qc: QueryClient, topics: ChangeTopic[]) {
  const families = new Set(topics.flatMap((t) => TOPIC_FAMILIES[t]));
  families.forEach((f) => void qc.invalidateQueries({ queryKey: [f] }));
}

/** Keep cached data fresh: realtime in live mode, store events in the demo. */
export function useLiveUpdates(topics: ChangeTopic[] = Object.keys(TOPIC_FAMILIES) as ChangeTopic[]) {
  const qc = useQueryClient();
  const key = topics.join(",");
  useEffect(() => {
    // Batch bursts (the demo simulator emits every second).
    let pending = new Set<ChangeTopic>();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = api.subscribe(key.split(",") as ChangeTopic[], (topic) => {
      pending.add(topic);
      if (timer) return;
      timer = setTimeout(() => {
        invalidateTopics(qc, [...pending]);
        pending = new Set();
        timer = null;
      }, 150);
    });
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [qc, key]);
}

export const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : typeof e === "string" ? e : "Something went wrong";

interface ApiMutationOptions<TVars, TData> extends Omit<UseMutationOptions<TData, Error, TVars>, "mutationFn"> {
  /** Toast shown on success (string or builder). */
  success?: string | ((data: TData, vars: TVars) => string | null);
  /** Topics to invalidate immediately (realtime also catches up). */
  invalidates?: ChangeTopic[];
  /** Suppress the default error toast. */
  silent?: boolean;
}

/** useMutation with toasts and cache invalidation wired in. */
export function useApiMutation<TVars = void, TData = unknown>(
  fn: (vars: TVars) => Promise<TData>,
  { success, invalidates = [], silent, onSuccess, onError, ...rest }: ApiMutationOptions<TVars, TData> = {}
) {
  const qc = useQueryClient();
  return useMutation<TData, Error, TVars>({
    mutationFn: fn,
    ...rest,
    onSuccess: (data, vars, ctx) => {
      invalidateTopics(qc, invalidates);
      const msg = typeof success === "function" ? success(data, vars) : success;
      if (msg) toast.success(msg);
      onSuccess?.(data, vars, ctx);
    },
    onError: (err, vars, ctx) => {
      if (!silent) toast.error(errorMessage(err));
      onError?.(err, vars, ctx);
    },
  });
}
