/**
 * In-browser "database" for demo mode. Shapes mirror the Postgres tables in
 * supabase/migrations so the mock API can apply the same business rules.
 * Persisted to localStorage; re-seeded automatically each new day so the demo
 * always looks current.
 */
import type {
  AccountStatus,
  Depot,
  Frequency,
  GatewayMethod,
  GatewayPurpose,
  GatewayStatus,
  MilkPrice,
  MilkType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Product,
  Profile,
  QualityRating,
  RiderLocation,
  SubscriptionStatus,
  TxnStatus,
  TxnType,
  UserRole,
} from "../types";

export interface DbProfile extends Profile {
  /** Only set for accounts created inside the demo; seeded accounts accept any password. */
  password?: string;
  license_number?: string | null;
}

export interface DbFarmer {
  id: string;
  farmer_code: number;
  farm_name: string;
  farm_location: string | null;
  production_capacity: number | null;
}

export interface DbOrder {
  id: string;
  customer_id: string;
  total_amount: number;
  status: OrderStatus;
  payment_method: PaymentMethod;
  delivery_person_id: string | null;
  delivery_address: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  delivery_notes: string | null;
  delivery_otp: string;
  assigned_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  created_at: string;
  source: "order" | "subscription";
  subscription_id?: string | null;
  delivery_slot_id?: string | null;
  /** Gateway payment (pay_…) for online orders. */
  gateway_payment_id?: string | null;
}

export interface DbOrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
}

export interface DbWalletTxn {
  id: string;
  user_id: string;
  amount: number;
  transaction_type: TxnType;
  status: TxnStatus;
  description: string | null;
  order_id: string | null;
  created_at: string;
}

export interface DbPayment {
  id: string;
  farmer_id: string;
  amount: number;
  status: PaymentStatus;
  payment_date: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

export interface DbContribution {
  id: string;
  farmer_id: string;
  quantity: number;
  milk_type: MilkType;
  quality_rating: QualityRating | null;
  contribution_date: string;
  payment_id: string | null;
  collected_by: string | null;
  created_at: string;
}

export interface DbStock {
  date: string;
  total_stock: number;
}

export interface DbArchive {
  id: string;
  date: string;
  total_stock: number;
  subscription_demand: number;
  leftover_stock: number;
}

export interface DbReservation {
  id: string;
  reservation_date: string;
  reserved_amount: number;
  reservation_type: "subscription";
}

export interface DbGatewayPayment {
  /** Razorpay-style order id (order_…), created before checkout. */
  gateway_order_id: string;
  /** Payment id (pay_…), set on capture/failure. */
  id: string | null;
  user_id: string;
  amount: number;
  purpose: GatewayPurpose;
  method: GatewayMethod | null;
  method_detail: string | null;
  status: GatewayStatus;
  failure_reason: string | null;
  order_id: string | null;
  created_at: string;
  captured_at: string | null;
  refunded_at: string | null;
}

export interface DbSlot {
  id: string;
  slot_date: string;
  start_time: string; // HH:MM
  end_time: string;
  capacity: number;
  is_active: boolean;
}

export interface DbSubscriptionSkip {
  subscription_id: string;
  skip_date: string;
}

export interface DbSubscription {
  id: string;
  customer_id: string;
  product_id: string | null;
  milk_type: MilkType;
  quantity: number;
  frequency: Frequency;
  status: SubscriptionStatus;
  next_delivery: string | null;
  created_at: string;
  preferred_slot_start?: string | null;
}

export interface DbNotification {
  id: string;
  /** user id, or a role to notify every user with that role */
  audience: string | UserRole;
  title: string;
  body: string;
  kind: "order" | "payment" | "delivery" | "system";
  link?: string;
  created_at: string;
}

export interface DemoDb {
  version: number;
  seededOn: string;
  depot: Depot;
  profiles: DbProfile[];
  farmers: DbFarmer[];
  products: Product[];
  pricing: MilkPrice[];
  orders: DbOrder[];
  orderItems: DbOrderItem[];
  wallet: DbWalletTxn[];
  payments: DbPayment[];
  contributions: DbContribution[];
  stock: DbStock[];
  archive: DbArchive[];
  reservations: DbReservation[];
  subscriptions: DbSubscription[];
  subscriptionSkips: DbSubscriptionSkip[];
  slots: DbSlot[];
  gatewayPayments: DbGatewayPayment[];
  riderLocations: RiderLocation[];
  notifications: DbNotification[];
  nextFarmerCode: number;
  /** Demo auto-dispatch: bot riders pick up and deliver orders by themselves. */
  autoDispatch: boolean;
  /** Riders driven by a person in demo mode whose movement is simulated along the route. */
  selfDrive?: Record<string, boolean>;
}

export const DB_VERSION = 4;
export const DB_KEY = "milkyway.demo.db";
export const SESSION_KEY = "milkyway.demo.session";

export const DEMO_ACCOUNTS: Record<UserRole, string> = {
  admin: "admin@milkyway.demo",
  farmer: "rajan@milkyway.demo",
  customer: "priya@milkyway.demo",
  delivery: "arjun@milkyway.demo",
};

/** Razorpay-like ids: order_/pay_ + 14 base62 chars. */
export function gatewayId(prefix: "order" | "pay"): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 14; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return `${prefix}_${out}`;
}

let counter = 0;
export function uid(prefix = ""): string {
  counter = (counter + 1) % 1_000_000;
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${counter}`;
  return prefix ? `${prefix}_${rand}` : rand;
}

export function loadDb(): DemoDb | null {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return null;
    const db = JSON.parse(raw) as DemoDb;
    return db.version === DB_VERSION ? db : null;
  } catch {
    return null;
  }
}

export function saveDb(db: DemoDb): void {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    // storage full or unavailable (private mode): the demo keeps working in memory
  }
}

export function loadSession(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function saveSession(userId: string | null): void {
  try {
    if (userId) localStorage.setItem(SESSION_KEY, userId);
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

export const statusOf = (db: DemoDb, userId: string): AccountStatus | undefined =>
  db.profiles.find((p) => p.id === userId)?.status;
