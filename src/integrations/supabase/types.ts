export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      delivery_slots: {
        Row: {
          booked_count: number
          capacity: number
          created_at: string
          id: string
          slot_time: string
          status: string
        }
        Insert: {
          booked_count?: number
          capacity: number
          created_at?: string
          id?: string
          slot_time: string
          status?: string
        }
        Update: {
          booked_count?: number
          capacity?: number
          created_at?: string
          id?: string
          slot_time?: string
          status?: string
        }
        Relationships: []
      }
      farmer_payments: {
        Row: {
          amount: number
          created_at: string
          farmer_id: string
          id: string
          notes: string | null
          payment_date: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          farmer_id: string
          id?: string
          notes?: string | null
          payment_date?: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          farmer_id?: string
          id?: string
          notes?: string | null
          payment_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "farmer_payments_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      farmers: {
        Row: {
          certification_details: string | null
          created_at: string
          farm_location: string | null
          farm_name: string | null
          farm_size: number | null
          farmer_id: number | null
          id: string
          production_capacity: number | null
          updated_at: string
        }
        Insert: {
          certification_details?: string | null
          created_at?: string
          farm_location?: string | null
          farm_name?: string | null
          farm_size?: number | null
          farmer_id?: number | null
          id: string
          production_capacity?: number | null
          updated_at?: string
        }
        Update: {
          certification_details?: string | null
          created_at?: string
          farm_location?: string | null
          farm_name?: string | null
          farm_size?: number | null
          farmer_id?: number | null
          id?: string
          production_capacity?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "farmers_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      milk_contributions: {
        Row: {
          contribution_date: string
          created_at: string
          farmer_id: string
          id: string
          milk_type: string
          payment_id: string | null
          price: number | null
          quality_rating: number | null
          quantity: number
        }
        Insert: {
          contribution_date?: string
          created_at?: string
          farmer_id: string
          id?: string
          milk_type?: string
          payment_id?: string | null
          price?: number | null
          quality_rating?: number | null
          quantity: number
        }
        Update: {
          contribution_date?: string
          created_at?: string
          farmer_id?: string
          id?: string
          milk_type?: string
          payment_id?: string | null
          price?: number | null
          quality_rating?: number | null
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "milk_contributions_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milk_contributions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "farmer_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      milk_pricing: {
        Row: {
          created_at: string
          id: string
          milk_type: string
          price_per_liter: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          milk_type: string
          price_per_liter: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          milk_type?: string
          price_per_liter?: number
          updated_at?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id: string
          quantity: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_id: string
          delivery_slot: string | null
          id: string
          payment_method: string
          qr_code: string | null
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          delivery_slot?: string | null
          id?: string
          payment_method?: string
          qr_code?: string | null
          status?: string
          total_amount: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          delivery_slot?: string | null
          id?: string
          payment_method?: string
          qr_code?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          description: string | null
          id: string
          milk_type: string
          name: string
          price: number
          stock_quantity: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          milk_type?: string
          name: string
          price: number
          stock_quantity?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          milk_type?: string
          name?: string
          price?: number
          stock_quantity?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          status: Database["public"]["Enums"]["profile_status"] | null
          updated_at: string
          user_type: Database["public"]["Enums"]["user_type"]
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          status?: Database["public"]["Enums"]["profile_status"] | null
          updated_at?: string
          user_type: Database["public"]["Enums"]["user_type"]
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          status?: Database["public"]["Enums"]["profile_status"] | null
          updated_at?: string
          user_type?: Database["public"]["Enums"]["user_type"]
        }
        Relationships: []
      }
      stock_reservations: {
        Row: {
          created_at: string
          id: string
          reservation_date: string
          reservation_type: string
          reserved_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          reservation_date: string
          reservation_type?: string
          reserved_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          reservation_date?: string
          reservation_type?: string
          reserved_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          customer_id: string
          frequency: string
          id: string
          next_delivery: string | null
          product_id: string
          quantity: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          frequency: string
          id?: string
          next_delivery?: string | null
          product_id: string
          quantity: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          frequency?: string
          id?: string
          next_delivery?: string | null
          product_id?: string
          quantity?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          status: string
          transaction_type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          status?: string
          transaction_type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          status?: string
          transaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      milk_stock_archive: {
        Row: {
          id: string;
          date: string;
          total_stock: number;
          subscription_demand: number;
          leftover_stock: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          date: string;
          total_stock: number;
          subscription_demand: number;
          leftover_stock: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          date?: string;
          total_stock?: number;
          subscription_demand?: number;
          leftover_stock?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    }
    Views: {
      milk_stock: {
        Row: {
          total_stock: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_stock_availability: {
        Args: { requested_quantity: number }
        Returns: boolean
      }
      update_milk_stock_safe: {
        Args: { add_quantity: number }
        Returns: boolean
      }
      archive_and_reset_daily_stock: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      get_today_stock_summary: {
        Args: Record<PropertyKey, never>;
        Returns: {
          total_stock: number;
          available_stock: number;
          subscription_demand: number;
          leftover_from_yesterday: number;
        };
      };
    }
    Enums: {
      delivery_status: "pending" | "delivered" | "rejected"
      profile_status: "pending" | "approved" | "rejected"
      user_type: "admin" | "farmer" | "customer" | "delivery"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      delivery_status: ["pending", "delivered", "rejected"],
      profile_status: ["pending", "approved", "rejected"],
      user_type: ["admin", "farmer", "customer", "delivery"],
    },
  },
} as const
