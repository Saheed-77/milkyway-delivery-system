import type { ChangeTopic, DataApi } from "../api";
import { supabaseAuth } from "./auth";
import { orders, products, subscriptions, wallet } from "./commerce";
import { contributions, farmers, payments, pricing } from "./farm";
import { gateway, slots } from "./payments";
import { delivery, notifications, reports, stock } from "./operations";
import { sb } from "./shared";

const TOPIC_TABLES: Partial<Record<ChangeTopic, string>> = {
  orders: "orders",
  wallet: "wallet_transactions",
  stock: "milk_stock",
  farmers: "profiles",
  payments: "farmer_payments",
  contributions: "milk_contributions",
  subscriptions: "subscriptions",
  rider_locations: "rider_locations",
  gateway: "gateway_payments",
  slots: "delivery_slots",
};

let channelSeq = 0;

export const supabaseApi: DataApi = {
  mode: "live",
  auth: supabaseAuth,
  products,
  wallet,
  gateway,
  slots,
  orders,
  subscriptions,
  farmers,
  contributions,
  payments,
  pricing,
  stock,
  delivery,
  reports,
  notifications,

  /** Postgres changes over Supabase Realtime (RLS still applies). */
  subscribe(topics, cb) {
    const channel = sb().channel(`mw-${++channelSeq}`);
    for (const topic of topics) {
      const table = TOPIC_TABLES[topic];
      if (!table) continue;
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => cb(topic));
    }
    channel.subscribe();
    return () => {
      void sb().removeChannel(channel);
    };
  },
};
