import type {
  AccountStatus,
  AppNotification,
  CapturePaymentInput,
  CollectionInput,
  CollectionResult,
  Contribution,
  CreateFarmerInput,
  CreateSubscriptionInput,
  DateRange,
  DeliverySlot,
  Depot,
  Farmer,
  FarmerPayment,
  GatewayOrder,
  GatewayPayment,
  GatewayPurpose,
  InventoryArchiveRow,
  InventorySummary,
  MilkPrice,
  MilkType,
  Order,
  OrderStatus,
  OrderTracking,
  PlaceOrderInput,
  Product,
  Profile,
  ProfileUpdate,
  ReportDataset,
  Rider,
  RiderLocation,
  SignUpInput,
  SignUpResult,
  StockSummary,
  Subscription,
  SubscriptionStatus,
  UserRole,
  WalletTransaction,
} from "./types";

export type Unsubscribe = () => void;

/** Tables whose changes the UI listens to (realtime in live mode, events in demo). */
export type ChangeTopic =
  | "orders"
  | "wallet"
  | "stock"
  | "farmers"
  | "payments"
  | "contributions"
  | "subscriptions"
  | "pricing"
  | "rider_locations"
  | "gateway"
  | "slots";

export interface AuthApi {
  getProfile(): Promise<Profile | null>;
  /** Fires with the new profile (or null) whenever the session changes. */
  onChange(cb: (profile: Profile | null) => void): Unsubscribe;
  signIn(email: string, password: string): Promise<Profile>;
  signUp(input: SignUpInput): Promise<SignUpResult>;
  signOut(): Promise<void>;
  updateProfile(patch: ProfileUpdate): Promise<Profile>;
  /** Demo only: sign in as the seeded account for a role. */
  demoSignIn?(role: UserRole): Promise<Profile>;
}

export interface DataApi {
  readonly mode: "demo" | "live";
  auth: AuthApi;

  products: {
    list(opts?: { includeInactive?: boolean }): Promise<Product[]>;
    update(id: string, patch: Partial<Pick<Product, "price" | "is_active" | "name">>): Promise<void>;
  };

  wallet: {
    balance(): Promise<number>;
    transactions(limit?: number): Promise<WalletTransaction[]>;
  };

  /**
   * Razorpay-shaped payment gateway (simulated / test mode). Flow:
   * createOrder → checkout UI → capture (or fail). Capturing a wallet top-up
   * credits the wallet exactly once; an "order" payment is consumed by
   * orders.place and refunded if the order is cancelled or can't be created.
   */
  gateway: {
    createOrder(input: { amount: number; purpose: GatewayPurpose }): Promise<GatewayOrder>;
    capture(gatewayOrderId: string, input: CapturePaymentInput): Promise<GatewayPayment>;
    fail(gatewayOrderId: string, input: CapturePaymentInput & { reason: string }): Promise<GatewayPayment>;
    mine(): Promise<GatewayPayment[]>;
  };

  slots: {
    /** Delivery windows for `days` days starting `from` (YYYY-MM-DD), with live booking counts. */
    list(from: string, days: number): Promise<DeliverySlot[]>;
    /** Admin */
    update(id: string, patch: Partial<Pick<DeliverySlot, "capacity" | "is_active">>): Promise<void>;
  };

  orders: {
    place(input: PlaceOrderInput): Promise<string>;
    mine(): Promise<Order[]>;
    cancel(orderId: string): Promise<void>;
    tracking(orderId: string): Promise<OrderTracking>;
    /** Admin: all orders, newest first. */
    all(filter?: { status?: OrderStatus | "all"; range?: DateRange }): Promise<Order[]>;
    /** Admin: mark delivered without OTP (e.g. phone confirmation). */
    forceComplete(orderId: string): Promise<void>;
  };

  subscriptions: {
    mine(): Promise<Subscription[]>;
    create(input: CreateSubscriptionInput): Promise<void>;
    setStatus(id: string, status: SubscriptionStatus): Promise<void>;
    update(id: string, patch: { preferred_slot_start?: string | null }): Promise<void>;
    /** Skip (or un-skip) future delivery dates — one-off skips and vacation ranges. */
    setSkips(id: string, dates: string[], skip: boolean): Promise<void>;
    /** Admin: bill active subscriptions into delivery orders for a date. */
    generateOrders(date?: string): Promise<number>;
  };

  farmers: {
    list(): Promise<Farmer[]>;
    me(): Promise<Farmer | null>;
    setStatus(farmerId: string, status: AccountStatus): Promise<void>;
    create(input: CreateFarmerInput): Promise<Farmer>;
  };

  contributions: {
    mine(range?: DateRange): Promise<Contribution[]>;
    all(range?: DateRange): Promise<Contribution[]>;
    submitCollection(input: CollectionInput): Promise<CollectionResult>;
  };

  payments: {
    mine(): Promise<FarmerPayment[]>;
    all(): Promise<FarmerPayment[]>;
    request(): Promise<string>;
    review(paymentId: string, approve: boolean): Promise<void>;
    /** Unpaid value (at date-effective prices) for the signed-in farmer. */
    pendingValue(): Promise<{ liters: number; amount: number }>;
  };

  pricing: {
    current(): Promise<Record<MilkType, MilkPrice | null>>;
    history(): Promise<MilkPrice[]>;
    /** Inserts new rows effective today; history is preserved. */
    set(prices: Partial<Record<MilkType, number>>): Promise<void>;
  };

  stock: {
    today(): Promise<StockSummary>;
    adjust(delta: number): Promise<void>;
    reserveTomorrow(): Promise<number>;
    archiveAndReset(): Promise<boolean>;
    archive(range?: DateRange): Promise<InventoryArchiveRow[]>;
    summary(periodDays?: number): Promise<InventorySummary | null>;
  };

  delivery: {
    depot(): Promise<Depot>;
    /** Rider: orders assigned to me that are not finished, plus unassigned pending ones. */
    myStops(): Promise<{ assigned: Order[]; available: Order[] }>;
    myCompleted(range?: DateRange): Promise<Order[]>;
    claim(orderId: string): Promise<void>;
    start(orderId: string): Promise<void>;
    complete(orderId: string, otp: string): Promise<void>;
    updateLocation(loc: Pick<RiderLocation, "lat" | "lng" | "heading" | "speed">): Promise<void>;
    /** Admin */
    riders(): Promise<Rider[]>;
    assign(orderId: string, riderId: string | null): Promise<void>;
    autoAssign(): Promise<number>;
    locations(): Promise<RiderLocation[]>;
  };

  reports: {
    dataset(days: number): Promise<ReportDataset>;
  };

  notifications: {
    recent(): Promise<AppNotification[]>;
  };

  /** Subscribe to data changes; returns an unsubscribe function. */
  subscribe(topics: ChangeTopic[], cb: (topic: ChangeTopic) => void): Unsubscribe;
}
