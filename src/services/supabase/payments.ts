import * as rpc from "@/lib/rpc";
import type { DataApi } from "../api";
import type { GatewayPayment } from "../types";
import { currentUserId, must, sb } from "./shared";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapGateway = (r: any): GatewayPayment => ({
  id: r.payment_id ?? r.gateway_order_id,
  gateway_order_id: r.gateway_order_id,
  amount: Number(r.amount),
  purpose: r.purpose,
  method: r.method,
  method_detail: r.method_detail,
  status: r.status,
  failure_reason: r.failure_reason,
  order_id: r.order_id,
  created_at: r.created_at,
  refunded_at: r.refunded_at,
});

const GATEWAY_COLUMNS =
  "gateway_order_id, payment_id, amount, purpose, method, method_detail, status, failure_reason, order_id, created_at, refunded_at";

async function byOrderId(gatewayOrderId: string): Promise<GatewayPayment> {
  return mapGateway(must(await sb().from("gateway_payments").select(GATEWAY_COLUMNS).eq("gateway_order_id", gatewayOrderId).single()));
}

/**
 * Test-mode gateway: orders and captures are recorded server-side by RPCs.
 * Swap capture for a Razorpay webhook in production (see the migration).
 */
export const gateway: DataApi["gateway"] = {
  createOrder: ({ amount, purpose }) => rpc.createPaymentOrder(amount, purpose),
  async capture(gatewayOrderId, { method, detail }) {
    await rpc.captureTestPayment(gatewayOrderId, method, detail);
    return byOrderId(gatewayOrderId);
  },
  async fail(gatewayOrderId, { method, detail, reason }) {
    await rpc.failTestPayment(gatewayOrderId, method, detail, reason);
    return byOrderId(gatewayOrderId);
  },
  async mine() {
    const uid = await currentUserId();
    const rows = must(
      await sb()
        .from("gateway_payments")
        .select(GATEWAY_COLUMNS)
        .eq("user_id", uid)
        .neq("status", "created")
        .order("created_at", { ascending: false })
        .limit(100)
    );
    return rows.map(mapGateway);
  },
};

export const slots: DataApi["slots"] = {
  async list(from, days) {
    const rows = await rpc.getDeliverySlots(from, days);
    return (rows ?? []).map((r) => ({
      id: r.id,
      date: r.slot_date,
      start: r.start_time.slice(0, 5),
      end: r.end_time.slice(0, 5),
      capacity: r.capacity,
      booked: Number(r.booked),
      is_active: r.is_active,
      available: r.available,
    }));
  },
  async update(id, patch) {
    if (patch.capacity !== undefined && !(patch.capacity >= 1 && patch.capacity <= 500)) {
      throw new Error("Capacity must be between 1 and 500");
    }
    must(await sb().from("delivery_slots").update(patch).eq("id", id).select("id"));
  },
};
