import { getSupabase } from '@/integrations/supabase/client';

/**
 * Typed wrappers around the SECURITY DEFINER RPCs added in the
 * 20260711000001_secure_rebuild migration. All privileged mutations
 * (wallet, orders, stock, farmer payments) go through these — never
 * through direct table writes.
 *
 * The generated Database type predates these functions, so calls are
 * funneled through this single module with a narrow escape hatch.
 */

type RpcResult = PromiseLike<{ data: unknown; error: { message?: string } | null }>;

const rpc = (name: string, args?: Record<string, unknown>): RpcResult => {
  const client = getSupabase();
  return (client.rpc as unknown as (n: string, a?: Record<string, unknown>) => RpcResult).call(client, name, args);
};

async function call<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await rpc(name, args);
  if (error) throw new Error(error.message ?? `RPC ${name} failed`);
  return data as T;
}

export const getWalletBalance = () => call<number>('get_wallet_balance');

export const rechargeWallet = (amount: number) =>
  call<string>('recharge_wallet', { p_amount: amount });

export const placeOrder = (params: {
  milkType: string;
  quantity: number;
  paymentMethod: 'wallet' | 'cash';
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  notes?: string | null;
}) =>
  call<string>('place_order', {
    p_milk_type: params.milkType,
    p_quantity: params.quantity,
    p_payment_method: params.paymentMethod,
    p_address: params.address ?? null,
    p_lat: params.lat ?? null,
    p_lng: params.lng ?? null,
    p_notes: params.notes ?? null,
  });

export const cancelOrder = (orderId: string) =>
  call<boolean>('cancel_order', { p_order_id: orderId });

export const completeDelivery = (orderId: string, otp?: string) =>
  call<boolean>('complete_delivery', { p_order_id: orderId, p_otp: otp ?? null });

export const claimOrder = (orderId: string) => call<boolean>('claim_order', { p_order_id: orderId });

export const assignOrder = (orderId: string, riderId: string | null) =>
  call<boolean>('assign_order', { p_order_id: orderId, p_rider_id: riderId });

export const autoAssignOrders = (maxPerRider = 6) =>
  call<number>('auto_assign_orders', { p_max_per_rider: maxPerRider });

export const startDelivery = (orderId: string) =>
  call<boolean>('start_delivery', { p_order_id: orderId });

export const updateRiderLocation = (loc: {
  lat: number;
  lng: number;
  heading?: number | null;
  speed?: number | null;
}) =>
  call<boolean>('update_rider_location', {
    p_lat: loc.lat,
    p_lng: loc.lng,
    p_heading: loc.heading ?? null,
    p_speed: loc.speed ?? null,
  });

export interface TrackingPayload {
  otp: string | null;
  rider: { id: string; name: string; phone: string | null } | null;
  location: {
    rider_id: string;
    lat: number;
    lng: number;
    heading: number | null;
    speed: number | null;
    updated_at: string;
  } | null;
  depot: { id: string; name: string; address: string; lat: number; lng: number } | null;
}

export const getOrderTracking = (orderId: string) =>
  call<TrackingPayload>('get_order_tracking', { p_order_id: orderId });

export const generateSubscriptionOrders = (date?: string) =>
  call<number>('generate_subscription_orders', date ? { p_date: date } : undefined);

export const setFarmerStatus = (farmerId: string, status: 'approved' | 'rejected' | 'pending') =>
  call<boolean>('set_farmer_status', { p_farmer_id: farmerId, p_status: status });

export const recordMilkContribution = (params: {
  quantity: number;
  milkType: string;
  date?: string;
}) =>
  call<string>('record_milk_contribution', {
    p_quantity: params.quantity,
    p_milk_type: params.milkType,
    ...(params.date ? { p_date: params.date } : {}),
  });

export const recordMilkCollection = (params: {
  farmerId: string;
  quantity: number;
  milkType?: string;
}) =>
  call<string>('record_milk_collection', {
    p_farmer_id: params.farmerId,
    p_quantity: params.quantity,
    p_milk_type: params.milkType ?? 'cow',
  });

export const requestFarmerPayment = () => call<string>('request_farmer_payment');

export interface CollectionResult {
  outcome: 'recorded' | 'substandard' | 'blacklisted';
  offense_count: number;
  farmer_name: string;
  farmer_email: string;
}

export const submitMilkCollection = (params: {
  farmerCode: number;
  quantity: number;
  qualityRating: number;
  milkType?: string;
}) =>
  call<CollectionResult>('submit_milk_collection', {
    p_farmer_code: params.farmerCode,
    p_quantity: params.quantity,
    p_quality_rating: params.qualityRating,
    p_milk_type: params.milkType ?? 'cow',
  });

export const reviewFarmerPayment = (paymentId: string, approve: boolean) =>
  call<boolean>('review_farmer_payment', { p_payment_id: paymentId, p_approve: approve });

export interface StockSummary {
  total_stock: number;
  available_stock: number;
  subscription_demand: number;
  leftover_from_yesterday: number;
  sold_stock: number;
}

export const getTodayStockSummary = async (): Promise<StockSummary | null> => {
  const rows = await call<StockSummary[]>('get_today_stock_summary');
  return rows?.[0] ?? null;
};

export interface LatestStock {
  total_stock: number;
  available_stock: number;
  subscription_demand: number;
  date: string | null;
}

export const getLatestMilkStock = async (): Promise<LatestStock | null> => {
  const rows = await call<LatestStock[]>('get_latest_milk_stock');
  return rows?.[0] ?? null;
};

export const checkStockAvailability = (quantity: number) =>
  call<boolean>('check_stock_availability', { requested_quantity: quantity });

export const updateMilkStockSafe = (addQuantity: number) =>
  call<boolean>('update_milk_stock_safe', { add_quantity: addQuantity });

export const upsertMilkStock = (total: number) =>
  call<boolean>('upsert_milk_stock', { p_total: total });

export const autoReserveSubscriptionStock = () =>
  call<boolean>('auto_reserve_subscription_stock');

export const archiveAndResetDailyStock = () =>
  call<boolean>('archive_and_reset_daily_stock');

export const archiveMilkInventory = (archiveDate?: string) =>
  call<boolean>(
    'archive_milk_inventory',
    archiveDate ? { archive_date: archiveDate } : undefined
  );

export interface InventoryArchiveRow {
  id: string;
  date: string;
  total_stock: number;
  available_stock: number;
  subscription_demand: number;
  leftover_milk: number;
  created_at: string;
}

export const getMilkInventoryArchive = (startDate?: string, endDate?: string) =>
  call<InventoryArchiveRow[]>(
    'get_milk_inventory_archive',
    startDate && endDate ? { start_date: startDate, end_date: endDate } : undefined
  );

export interface InventorySummary {
  start_date: string;
  end_date: string;
  avg_total_stock: number;
  avg_subscription_demand: number;
  avg_leftover_milk: number;
  max_total_stock: number;
  min_total_stock: number;
  total_days: number;
}

export const getInventorySummary = async (periodDays = 30): Promise<InventorySummary | null> => {
  const rows = await call<InventorySummary[]>('get_inventory_summary', {
    period_days: periodDays,
  });
  return rows?.[0] ?? null;
};
