/**
 * Domain types shared by every backend (Supabase and the in-browser demo).
 * UI code depends on these, never on raw table rows.
 */
import type { LatLng } from "@/lib/geo";

export type UserRole = "admin" | "farmer" | "customer" | "delivery";
export type AccountStatus = "pending" | "approved" | "rejected";
export type MilkType = "cow" | "buffalo" | "goat";
export type OrderStatus = "pending" | "out_for_delivery" | "completed" | "cancelled";
export type PaymentMethod = "wallet" | "cash" | "online";
export type TxnType = "deposit" | "withdrawal";
export type TxnStatus = "pending" | "completed" | "failed";
export type PaymentStatus = "pending" | "approved" | "rejected";
export type Frequency = "daily" | "weekly" | "monthly";
export type SubscriptionStatus = "active" | "paused" | "cancelled";
export type QualityRating = 1 | 2 | 3;

export const MILK_TYPES: MilkType[] = ["cow", "buffalo", "goat"];

export interface Profile {
  id: string;
  email: string;
  user_type: UserRole;
  status: AccountStatus;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}

export type ProfileUpdate = Partial<
  Pick<Profile, "first_name" | "last_name" | "phone" | "address" | "latitude" | "longitude">
>;

export interface SignUpInput {
  role: UserRole;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  farmName?: string;
  farmLocation?: string;
  licenseNumber?: string;
}

export interface SignUpResult {
  /** True when the account can be used immediately (no email confirmation / approval). */
  active: boolean;
  message: string;
}

export interface Product {
  id: string;
  name: string;
  milk_type: MilkType;
  price: number;
  unit: string;
  is_active: boolean;
}

export interface OrderItem {
  product_id: string;
  product_name: string;
  milk_type: MilkType;
  quantity: number;
  unit_price: number;
}

/** A booked delivery window; null on an order means "express" (within the hour). */
export interface OrderSlot {
  id: string;
  date: string; // YYYY-MM-DD
  start: string; // HH:MM
  end: string; // HH:MM
}

export interface Order {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string | null;
  total_amount: number;
  status: OrderStatus;
  payment_method: PaymentMethod;
  delivery_person_id: string | null;
  rider_name: string | null;
  delivery_address: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  delivery_notes: string | null;
  /** Only populated for the order's own customer. */
  delivery_otp: string | null;
  assigned_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  created_at: string;
  items: OrderItem[];
  delivery_slot: OrderSlot | null;
  /** Gateway payment id for online orders (e.g. pay_ABC123). */
  payment_ref: string | null;
  /** Human-readable method for online payments, e.g. "UPI · priya@okhdfc". */
  payment_method_detail: string | null;
  /** Total liters across items. */
  quantity: number;
  source: "order" | "subscription";
}

export interface PlaceOrderInput {
  milkType: MilkType;
  quantity: number;
  paymentMethod: PaymentMethod;
  address?: string;
  lat?: number | null;
  lng?: number | null;
  notes?: string;
  /** Delivery slot id; omit for express delivery. */
  slotId?: string | null;
  /** Required when paymentMethod is "online": a captured gateway order of the exact total. */
  gatewayOrderId?: string | null;
}

export type GatewayPurpose = "wallet_topup" | "order";
export type GatewayMethod = "upi" | "card" | "netbanking" | "wallet";
export type GatewayStatus = "created" | "captured" | "failed" | "refunded";

/** Razorpay-style order created before checkout opens. */
export interface GatewayOrder {
  id: string; // order_XXXX
  amount: number;
  currency: "INR";
  purpose: GatewayPurpose;
  status: GatewayStatus;
}

export interface GatewayPayment {
  id: string; // pay_XXXX (assigned on capture/failure)
  gateway_order_id: string;
  amount: number;
  purpose: GatewayPurpose;
  method: GatewayMethod | null;
  method_detail: string | null;
  status: GatewayStatus;
  failure_reason: string | null;
  order_id: string | null;
  created_at: string;
  refunded_at: string | null;
}

export interface CapturePaymentInput {
  method: GatewayMethod;
  /** Display-safe detail only: UPI id, card network + last 4, bank or wallet name. Never full card data. */
  detail: string;
}

export interface DeliverySlot {
  id: string;
  date: string;
  start: string; // HH:MM
  end: string; // HH:MM
  capacity: number;
  booked: number;
  is_active: boolean;
  /** Bookable right now: active, not full and before the cutoff. */
  available: boolean;
}

export interface WalletTransaction {
  id: string;
  amount: number;
  transaction_type: TxnType;
  status: TxnStatus;
  description: string | null;
  order_id: string | null;
  created_at: string;
}

export interface Subscription {
  id: string;
  product_id: string | null;
  product_name: string;
  milk_type: MilkType;
  quantity: number;
  frequency: Frequency;
  status: SubscriptionStatus;
  next_delivery: string | null;
  created_at: string;
  /** Preferred delivery window start (HH:MM), null = any morning slot. */
  preferred_slot_start: string | null;
  /** Upcoming dates (YYYY-MM-DD) the customer has skipped — vacation or one-off. */
  skip_dates: string[];
}

export interface CreateSubscriptionInput {
  productId: string;
  quantity: number;
  frequency: Frequency;
  preferredSlotStart?: string | null;
}

export interface Farmer {
  id: string;
  farmer_code: number;
  first_name: string | null;
  last_name: string | null;
  name: string;
  email: string;
  phone: string | null;
  status: AccountStatus;
  farm_name: string;
  farm_location: string | null;
  production_capacity: number | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}

export interface CreateFarmerInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  farmName: string;
  farmLocation?: string;
  productionCapacity?: number | null;
}

export interface Contribution {
  id: string;
  farmer_id: string;
  farmer_name: string;
  farmer_code: number | null;
  quantity: number;
  milk_type: MilkType;
  quality_rating: QualityRating | null;
  contribution_date: string;
  payment_id: string | null;
  payment_status: PaymentStatus | null;
  /** Value at the price effective on the contribution date. */
  value: number;
  created_at: string;
}

export interface FarmerPayment {
  id: string;
  farmer_id: string;
  farmer_name: string;
  farmer_code: number | null;
  amount: number;
  status: PaymentStatus;
  payment_date: string;
  approved_at: string | null;
  created_at: string;
  liters: number;
  contribution_count: number;
}

export interface MilkPrice {
  id: string;
  milk_type: MilkType;
  price_per_liter: number;
  effective_from: string;
}

export interface CollectionInput {
  farmerCode: number;
  quantity: number;
  qualityRating: QualityRating;
  milkType: MilkType;
}

export interface CollectionResult {
  outcome: "recorded" | "substandard" | "blacklisted";
  offense_count: number;
  farmer_name: string;
  farmer_email: string;
}

export interface StockSummary {
  total_stock: number;
  available_stock: number;
  subscription_demand: number;
  leftover_from_yesterday: number;
  sold_stock: number;
  reserved_today: number;
  reserved_tomorrow: number;
  date: string;
}

export interface InventoryArchiveRow {
  id: string;
  date: string;
  total_stock: number;
  available_stock: number;
  subscription_demand: number;
  leftover_milk: number;
}

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

export interface Depot extends LatLng {
  id: string;
  name: string;
  address: string;
}

export interface RiderLocation extends LatLng {
  rider_id: string;
  heading: number | null;
  speed: number | null;
  updated_at: string;
}

export interface Rider {
  id: string;
  name: string;
  phone: string | null;
  location: RiderLocation | null;
  active_orders: number;
  completed_today: number;
}

export interface OrderTracking {
  order: Order;
  rider: { id: string; name: string; phone: string | null } | null;
  location: RiderLocation | null;
  depot: Depot;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  created_at: string;
  kind: "order" | "payment" | "delivery" | "system";
  link?: string;
}

/** Raw rows for analytics; aggregation happens client-side in services/analytics.ts. */
export interface ReportDataset {
  orders: Order[];
  contributions: Contribution[];
  signups: Pick<Profile, "id" | "user_type" | "created_at">[];
}

export interface DateRange {
  from?: string; // YYYY-MM-DD inclusive
  to?: string; // YYYY-MM-DD inclusive
}
