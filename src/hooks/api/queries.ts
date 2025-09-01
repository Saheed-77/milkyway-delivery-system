/**
 * React Query hooks over the service layer. Components use these instead of
 * calling Supabase or the demo backend directly.
 */
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services";
import type {
  AccountStatus,
  CollectionInput,
  CreateFarmerInput,
  CreateSubscriptionInput,
  DateRange,
  MilkType,
  OrderStatus,
  PlaceOrderInput,
  RiderLocation,
  SubscriptionStatus,
} from "@/services";
import { useApiMutation } from "./core";

/* ----------------------------------------------------------- catalogue */

export const useProducts = (includeInactive = false) =>
  useQuery({ queryKey: ["products", { includeInactive }], queryFn: () => api.products.list({ includeInactive }) });

export const useUpdateProduct = () =>
  useApiMutation(
    ({ id, ...patch }: { id: string; price?: number; is_active?: boolean; name?: string }) => api.products.update(id, patch),
    { success: "Product updated", invalidates: ["pricing"] }
  );

export const useCurrentPrices = () => useQuery({ queryKey: ["pricing", "current"], queryFn: api.pricing.current });
export const usePriceHistory = () => useQuery({ queryKey: ["pricing", "history"], queryFn: api.pricing.history });
export const useSetPrices = () =>
  useApiMutation((prices: Partial<Record<MilkType, number>>) => api.pricing.set(prices), {
    success: "New prices are effective from today",
    invalidates: ["pricing"],
  });

/* --------------------------------------------------------------- wallet */

export const useWalletBalance = () => useQuery({ queryKey: ["wallet", "balance"], queryFn: api.wallet.balance });
export const useWalletTransactions = (limit = 100) =>
  useQuery({ queryKey: ["wallet", "transactions", limit], queryFn: () => api.wallet.transactions(limit) });
export const useRecharge = () =>
  useApiMutation((amount: number) => api.wallet.recharge(amount), {
    success: (_d, amount) => `₹${amount.toLocaleString("en-IN")} added to your wallet`,
    invalidates: ["wallet"],
  });

/* --------------------------------------------------------------- orders */

export const useMyOrders = () => useQuery({ queryKey: ["orders", "mine"], queryFn: api.orders.mine });
export const useAllOrders = (status: OrderStatus | "all" = "all", range?: DateRange) =>
  useQuery({ queryKey: ["orders", "all", status, range], queryFn: () => api.orders.all({ status, range }) });
export const useOrderTracking = (orderId: string | undefined) =>
  useQuery({
    queryKey: ["tracking", orderId],
    queryFn: () => api.orders.tracking(orderId!),
    enabled: !!orderId,
    refetchInterval: api.mode === "live" ? 15_000 : false, // realtime does the rest
  });
export const usePlaceOrder = () =>
  useApiMutation((input: PlaceOrderInput) => api.orders.place(input), {
    success: "Order placed — we'll let you know when it's on the way",
    invalidates: ["orders", "wallet", "stock"],
  });
export const useCancelOrder = () =>
  useApiMutation((orderId: string) => api.orders.cancel(orderId), {
    success: "Order cancelled. Wallet payments are refunded instantly.",
    invalidates: ["orders", "wallet", "stock"],
  });
export const useForceComplete = () =>
  useApiMutation((orderId: string) => api.orders.forceComplete(orderId), {
    success: "Marked as delivered",
    invalidates: ["orders"],
  });

/* -------------------------------------------------------- subscriptions */

export const useMySubscriptions = () => useQuery({ queryKey: ["subscriptions", "mine"], queryFn: api.subscriptions.mine });
export const useCreateSubscription = () =>
  useApiMutation((input: CreateSubscriptionInput) => api.subscriptions.create(input), {
    success: "Subscription started",
    invalidates: ["subscriptions"],
  });
export const useSetSubscriptionStatus = () =>
  useApiMutation(({ id, status }: { id: string; status: SubscriptionStatus }) => api.subscriptions.setStatus(id, status), {
    success: (_d, v) => (v.status === "active" ? "Subscription resumed" : v.status === "paused" ? "Subscription paused" : "Subscription cancelled"),
    invalidates: ["subscriptions"],
  });
export const useGenerateSubscriptionOrders = () =>
  useApiMutation((date?: string) => api.subscriptions.generateOrders(date), {
    success: (n) => (n ? `${n} subscription order(s) created` : "No subscription deliveries due"),
    invalidates: ["orders", "wallet", "stock", "subscriptions"],
  });

/* -------------------------------------------------------------- farmers */

export const useFarmers = () => useQuery({ queryKey: ["farmers", "all"], queryFn: api.farmers.list });
export const useMyFarm = () => useQuery({ queryKey: ["farmers", "me"], queryFn: api.farmers.me });
export const useSetFarmerStatus = () =>
  useApiMutation(({ id, status }: { id: string; status: AccountStatus }) => api.farmers.setStatus(id, status), {
    success: (_d, v) => (v.status === "approved" ? "Farmer approved" : v.status === "rejected" ? "Farmer blacklisted" : "Farmer moved to review"),
    invalidates: ["farmers"],
  });
export const useCreateFarmer = () =>
  useApiMutation((input: CreateFarmerInput) => api.farmers.create(input), {
    success: (f) => `${f.name} registered with Farmer ID ${f.farmer_code}`,
    invalidates: ["farmers"],
  });

export const useMyContributions = (range?: DateRange) =>
  useQuery({ queryKey: ["contributions", "mine", range], queryFn: () => api.contributions.mine(range) });
export const useAllContributions = (range?: DateRange) =>
  useQuery({ queryKey: ["contributions", "all", range], queryFn: () => api.contributions.all(range) });
export const useSubmitCollection = () =>
  useApiMutation((input: CollectionInput) => api.contributions.submitCollection(input), {
    invalidates: ["contributions", "stock", "farmers"],
  });

export const useMyPayments = () => useQuery({ queryKey: ["payments", "mine"], queryFn: api.payments.mine });
export const useAllPayments = () => useQuery({ queryKey: ["payments", "all"], queryFn: api.payments.all });
export const usePendingValue = () => useQuery({ queryKey: ["payments", "pending-value"], queryFn: api.payments.pendingValue });
export const useRequestPayment = () =>
  useApiMutation(() => api.payments.request(), {
    success: "Payment requested — you'll be notified when it's reviewed",
    invalidates: ["payments", "contributions"],
  });
export const useReviewPayment = () =>
  useApiMutation(({ id, approve }: { id: string; approve: boolean }) => api.payments.review(id, approve), {
    success: (_d, v) => (v.approve ? "Payment approved and credited" : "Payment rejected"),
    invalidates: ["payments", "contributions", "wallet"],
  });

/* ---------------------------------------------------------------- stock */

export const useStockToday = () => useQuery({ queryKey: ["stock", "today"], queryFn: api.stock.today });
export const useStockArchive = (range?: DateRange) =>
  useQuery({ queryKey: ["stock", "archive", range], queryFn: () => api.stock.archive(range) });
export const useInventorySummary = (days = 30) =>
  useQuery({ queryKey: ["stock", "summary", days], queryFn: () => api.stock.summary(days) });
export const useAdjustStock = () =>
  useApiMutation((delta: number) => api.stock.adjust(delta), { success: "Stock updated", invalidates: ["stock"] });
export const useReserveTomorrow = () =>
  useApiMutation(() => api.stock.reserveTomorrow(), {
    success: (n) => `Reserved ${n} L for tomorrow's subscriptions`,
    invalidates: ["stock"],
  });
export const useArchiveAndReset = () =>
  useApiMutation(() => api.stock.archiveAndReset(), {
    success: (done) => (done ? "Yesterday archived; leftover carried into today" : "Nothing to archive — yesterday is already archived"),
    invalidates: ["stock"],
  });

/* ------------------------------------------------------------- delivery */

export const useDepot = () => useQuery({ queryKey: ["stops", "depot"], queryFn: api.delivery.depot, staleTime: Infinity });
export const useMyStops = () => useQuery({ queryKey: ["stops", "mine"], queryFn: api.delivery.myStops });
export const useMyCompleted = (range?: DateRange) =>
  useQuery({ queryKey: ["orders", "completed-by-me", range], queryFn: () => api.delivery.myCompleted(range) });
export const useRiders = () =>
  useQuery({ queryKey: ["riders"], queryFn: api.delivery.riders, refetchInterval: api.mode === "live" ? 20_000 : false });
export const useClaimOrder = () =>
  useApiMutation((orderId: string) => api.delivery.claim(orderId), { success: "Added to your route", invalidates: ["orders"] });
export const useStartDelivery = () =>
  useApiMutation((orderIds: string[]) => Promise.all(orderIds.map((id) => api.delivery.start(id))), {
    success: (_d, ids) => (ids.length > 1 ? `Trip started with ${ids.length} stops` : "Out for delivery"),
    invalidates: ["orders"],
  });
export const useCompleteDelivery = () =>
  useApiMutation(({ orderId, otp }: { orderId: string; otp: string }) => api.delivery.complete(orderId, otp), {
    success: "Delivered! Nice work.",
    invalidates: ["orders"],
  });
export const useAssignOrder = () =>
  useApiMutation(({ orderId, riderId }: { orderId: string; riderId: string | null }) => api.delivery.assign(orderId, riderId), {
    success: (_d, v) => (v.riderId ? "Rider assigned" : "Order unassigned"),
    invalidates: ["orders"],
  });
export const useAutoAssign = () =>
  useApiMutation(() => api.delivery.autoAssign(), {
    success: (n) => (n ? `Assigned ${n} order(s) to the nearest riders` : "No unassigned orders with a location"),
    invalidates: ["orders"],
  });
export const useUpdateLocation = () =>
  useApiMutation(
    (loc: Pick<RiderLocation, "lat" | "lng" | "heading" | "speed">) => api.delivery.updateLocation(loc),
    { silent: true }
  );

/* ------------------------------------------------------- reports & misc */

export const useReportDataset = (days: number) =>
  useQuery({ queryKey: ["reports", days], queryFn: () => api.reports.dataset(days), staleTime: 60_000 });

export const useNotifications = () =>
  useQuery({ queryKey: ["notifications"], queryFn: api.notifications.recent, refetchInterval: 60_000 });
