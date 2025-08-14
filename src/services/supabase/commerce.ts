import * as rpc from "@/lib/rpc";
import { toLocalISODate, addDays } from "@/lib/format";
import type { DataApi } from "../api";
import type { MilkType, Product, Subscription, WalletTransaction } from "../types";
import { currentUserId, mapOrder, must, ORDER_SELECT, ORDER_SELECT_WITH_OTP, sb } from "./shared";

const endOfDay = (date: string) => toLocalISODate(addDays(new Date(`${date}T00:00:00`), 1));

export const products: DataApi["products"] = {
  async list(opts) {
    let q = sb().from("products").select("id, name, milk_type, price, unit, is_active").order("price");
    if (!opts?.includeInactive) q = q.eq("is_active", true);
    const rows = must(await q);
    return rows.map((r) => ({ ...r, milk_type: r.milk_type as MilkType, price: Number(r.price) }) as Product);
  },
  async update(id, patch) {
    if (patch.price !== undefined && !(patch.price > 0)) throw new Error("Price must be greater than zero");
    must(await sb().from("products").update(patch).eq("id", id).select("id"));
  },
};

export const wallet: DataApi["wallet"] = {
  balance: async () => Number(await rpc.getWalletBalance()) || 0,
  async transactions(limit = 100) {
    const uid = await currentUserId();
    const rows = must(
      await sb()
        .from("wallet_transactions")
        .select("id, amount, transaction_type, status, description, order_id, created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(limit)
    );
    return rows.map((r) => ({ ...r, amount: Number(r.amount) }) as WalletTransaction);
  },
  async recharge(amount) {
    await rpc.rechargeWallet(amount);
  },
};

export const orders: DataApi["orders"] = {
  async place(input) {
    return rpc.placeOrder({
      milkType: input.milkType,
      quantity: input.quantity,
      paymentMethod: input.paymentMethod,
      address: input.address,
      lat: input.lat,
      lng: input.lng,
      notes: input.notes,
    });
  },
  async mine() {
    const uid = await currentUserId();
    const rows = must(
      await sb().from("orders").select(ORDER_SELECT_WITH_OTP).eq("customer_id", uid).order("created_at", { ascending: false })
    );
    return rows.map(mapOrder);
  },
  async cancel(orderId) {
    await rpc.cancelOrder(orderId);
  },
  async tracking(orderId) {
    const [row, t] = await Promise.all([
      sb().from("orders").select(ORDER_SELECT).eq("id", orderId).single().then(must),
      rpc.getOrderTracking(orderId),
    ]);
    const order = mapOrder(row);
    order.delivery_otp = t.otp;
    return {
      order,
      rider: t.rider,
      location: t.location,
      depot: t.depot ?? { id: "default", name: "MilkyWay Hub", address: "", lat: order.delivery_lat ?? 0, lng: order.delivery_lng ?? 0 },
    };
  },
  async all(filter) {
    let q = sb().from("orders").select(ORDER_SELECT).order("created_at", { ascending: false }).limit(500);
    if (filter?.status && filter.status !== "all") q = q.eq("status", filter.status);
    if (filter?.range?.from) q = q.gte("created_at", new Date(`${filter.range.from}T00:00:00`).toISOString());
    if (filter?.range?.to) q = q.lt("created_at", new Date(`${endOfDay(filter.range.to)}T00:00:00`).toISOString());
    return must(await q).map(mapOrder);
  },
  async forceComplete(orderId) {
    await rpc.completeDelivery(orderId);
  },
};

export const subscriptions: DataApi["subscriptions"] = {
  async mine() {
    const uid = await currentUserId();
    const rows = must(
      await sb()
        .from("subscriptions")
        .select("id, product_id, milk_type, quantity, frequency, status, next_delivery, created_at, products ( name )")
        .eq("customer_id", uid)
        .order("created_at", { ascending: false })
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return rows.map((r: any) => {
      const product = Array.isArray(r.products) ? r.products[0] : r.products;
      return {
        id: r.id,
        product_id: r.product_id,
        product_name: product?.name ?? `${r.milk_type} milk`,
        milk_type: r.milk_type,
        quantity: Number(r.quantity),
        frequency: r.frequency,
        status: r.status,
        next_delivery: r.next_delivery,
        created_at: r.created_at,
      } as Subscription;
    });
  },
  async create(input) {
    if (!(input.quantity > 0) || input.quantity > 50) throw new Error("Quantity must be between 0.5 and 50 liters");
    const uid = await currentUserId();
    const product = must(
      await sb().from("products").select("id, milk_type").eq("id", input.productId).eq("is_active", true).single()
    );
    must(
      await sb()
        .from("subscriptions")
        .insert({
          customer_id: uid,
          product_id: product.id,
          milk_type: product.milk_type, // previously omitted, so every subscription defaulted to cow
          quantity: input.quantity,
          frequency: input.frequency,
          status: "active",
          next_delivery: addDays(new Date(), 1).toISOString(),
        })
        .select("id")
    );
  },
  async setStatus(id, status) {
    must(await sb().from("subscriptions").update({ status }).eq("id", id).select("id"));
  },
  generateOrders: (date) => rpc.generateSubscriptionOrders(date),
};
