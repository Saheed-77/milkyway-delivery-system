/**
 * Database types for the MilkyWay Delivery System.
 *
 * Hand-maintained to match supabase/migrations (secure_rebuild + delivery_maps).
 * Enum-backed columns are typed as string for compatibility with UI state;
 * the database enforces the real enum constraints.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type ProfileRow = {
  id: string;
  email: string;
  user_type: string;
  status: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  updated_at: string;
}

type FarmerRow = {
  id: string;
  farmer_id: number;
  farm_name: string;
  farm_location: string | null;
  production_capacity: number | null;
  created_at: string;
}

type ProductRow = {
  id: string;
  name: string;
  milk_type: string;
  price: number;
  unit: string;
  is_active: boolean;
  created_at: string;
}

type MilkPricingRow = {
  id: string;
  milk_type: string;
  price_per_liter: number;
  effective_from: string;
  created_at: string;
}

type OrderRow = {
  id: string;
  customer_id: string;
  total_amount: number;
  status: string;
  payment_method: string;
  delivery_person_id: string | null;
  delivered_at: string | null;
  delivery_address: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  delivery_notes: string | null;
  assigned_at: string | null;
  picked_up_at: string | null;
  source: string;
  subscription_id: string | null;
  created_at: string;
}

type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  created_at: string;
}

type WalletTransactionRow = {
  id: string;
  user_id: string;
  amount: number;
  transaction_type: string;
  status: string;
  description: string | null;
  order_id: string | null;
  created_at: string;
}

type FarmerPaymentRow = {
  id: string;
  farmer_id: string;
  amount: number;
  status: string;
  payment_date: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

type MilkContributionRow = {
  id: string;
  farmer_id: string;
  quantity: number;
  milk_type: string;
  quality_rating: number | null;
  contribution_date: string;
  payment_id: string | null;
  created_at: string;
}

type MilkCollectionRow = {
  id: string;
  farmer_id: string | null;
  collected_by: string | null;
  quantity: number;
  milk_type: string;
  created_at: string;
}

type MilkStockRow = {
  id: string;
  date: string;
  total_stock: number;
  created_at: string;
  updated_at: string;
}

type MilkStockArchiveRow = {
  id: string;
  date: string;
  total_stock: number;
  subscription_demand: number;
  leftover_stock: number;
  created_at: string;
}

type StockReservationRow = {
  id: string;
  reservation_date: string;
  reserved_amount: number;
  reservation_type: string;
  created_at: string;
}

type SubscriptionRow = {
  id: string;
  customer_id: string;
  product_id: string | null;
  milk_type: string;
  quantity: number;
  frequency: string;
  status: string;
  next_delivery: string | null;
  created_at: string;
}

type DeliverySlotRow = {
  id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  capacity: number;
  created_at: string;
}

type OrderOtpRow = {
  order_id: string;
  otp: string;
  created_at: string;
}

type DepotRow = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  is_active: boolean;
  created_at: string;
}

type RiderLocationRow = {
  rider_id: string;
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  updated_at: string;
}

type Insertable<T> = {
  [K in keyof T]?: T[K];
};

type TableDef<Row> = {
  Row: Row;
  Insert: Insertable<Row>;
  Update: Insertable<Row>;
  Relationships: {
    foreignKeyName: string;
    columns: string[];
    isOneToOne: boolean;
    referencedRelation: string;
    referencedColumns: string[];
  }[];
}

export type Database = {
  public: {
    Tables: {
      profiles: TableDef<ProfileRow>;
      farmers: TableDef<FarmerRow>;
      products: TableDef<ProductRow>;
      milk_pricing: TableDef<MilkPricingRow>;
      orders: TableDef<OrderRow>;
      order_items: TableDef<OrderItemRow>;
      wallet_transactions: TableDef<WalletTransactionRow>;
      farmer_payments: TableDef<FarmerPaymentRow>;
      milk_contributions: TableDef<MilkContributionRow>;
      milk_collections: TableDef<MilkCollectionRow>;
      milk_stock: TableDef<MilkStockRow>;
      milk_stock_archive: TableDef<MilkStockArchiveRow>;
      stock_reservations: TableDef<StockReservationRow>;
      subscriptions: TableDef<SubscriptionRow>;
      delivery_slots: TableDef<DeliverySlotRow>;
      order_otps: TableDef<OrderOtpRow>;
      depots: TableDef<DepotRow>;
      rider_locations: TableDef<RiderLocationRow>;
    };
    Views: Record<string, never>;
    Functions: {
      get_wallet_balance: { Args: Record<string, never>; Returns: number };
      recharge_wallet: { Args: { p_amount: number }; Returns: string };
      place_order: {
        Args: {
          p_milk_type: string;
          p_quantity: number;
          p_payment_method: string;
          p_address?: string | null;
          p_lat?: number | null;
          p_lng?: number | null;
          p_notes?: string | null;
        };
        Returns: string;
      };
      cancel_order: { Args: { p_order_id: string }; Returns: boolean };
      complete_delivery: { Args: { p_order_id: string; p_otp?: string | null }; Returns: boolean };
      claim_order: { Args: { p_order_id: string }; Returns: boolean };
      assign_order: { Args: { p_order_id: string; p_rider_id: string | null }; Returns: boolean };
      auto_assign_orders: { Args: { p_max_per_rider?: number }; Returns: number };
      start_delivery: { Args: { p_order_id: string }; Returns: boolean };
      update_rider_location: {
        Args: { p_lat: number; p_lng: number; p_heading?: number | null; p_speed?: number | null };
        Returns: boolean;
      };
      get_order_tracking: { Args: { p_order_id: string }; Returns: Json };
      generate_subscription_orders: { Args: { p_date?: string }; Returns: number };
      set_farmer_status: {
        Args: { p_farmer_id: string; p_status: string };
        Returns: boolean;
      };
      record_milk_contribution: {
        Args: { p_quantity: number; p_milk_type: string; p_date?: string };
        Returns: string;
      };
      record_milk_collection: {
        Args: { p_farmer_id: string; p_quantity: number; p_milk_type?: string };
        Returns: string;
      };
      submit_milk_collection: {
        Args: {
          p_farmer_code: number;
          p_quantity: number;
          p_quality_rating: number;
          p_milk_type?: string;
        };
        Returns: Json;
      };
      request_farmer_payment: { Args: Record<string, never>; Returns: string };
      review_farmer_payment: {
        Args: { p_payment_id: string; p_approve: boolean };
        Returns: boolean;
      };
      get_latest_milk_stock: {
        Args: Record<string, never>;
        Returns: {
          total_stock: number;
          available_stock: number;
          subscription_demand: number;
          date: string | null;
        }[];
      };
      get_today_stock_summary: {
        Args: Record<string, never>;
        Returns: {
          total_stock: number;
          available_stock: number;
          subscription_demand: number;
          leftover_from_yesterday: number;
          sold_stock: number;
        }[];
      };
      check_stock_availability: {
        Args: { requested_quantity: number };
        Returns: boolean;
      };
      update_milk_stock_safe: { Args: { add_quantity: number }; Returns: boolean };
      upsert_milk_stock: { Args: { p_total: number }; Returns: boolean };
      auto_reserve_subscription_stock: { Args: Record<string, never>; Returns: boolean };
      archive_and_reset_daily_stock: { Args: Record<string, never>; Returns: boolean };
      archive_milk_inventory: { Args: { archive_date?: string }; Returns: boolean };
      get_milk_inventory_archive: {
        Args: { start_date?: string; end_date?: string };
        Returns: {
          id: string;
          date: string;
          total_stock: number;
          available_stock: number;
          subscription_demand: number;
          leftover_milk: number;
          created_at: string;
        }[];
      };
      get_inventory_summary: {
        Args: { period_days?: number };
        Returns: {
          start_date: string;
          end_date: string;
          avg_total_stock: number;
          avg_subscription_demand: number;
          avg_leftover_milk: number;
          max_total_stock: number;
          min_total_stock: number;
          total_days: number;
        }[];
      };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      is_delivery: { Args: Record<string, never>; Returns: boolean };
      is_approved_farmer: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: {
      user_role: "admin" | "farmer" | "customer" | "delivery";
      account_status: "pending" | "approved" | "rejected";
      order_status: "pending" | "out_for_delivery" | "completed" | "cancelled";
      payment_method: "wallet" | "cash";
      txn_type: "deposit" | "withdrawal";
      txn_status: "pending" | "completed" | "failed";
      payment_status: "pending" | "approved" | "rejected";
      milk_kind: "cow" | "buffalo" | "goat";
      sub_frequency: "daily" | "weekly" | "monthly";
    };
    CompositeTypes: Record<string, never>;
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];
