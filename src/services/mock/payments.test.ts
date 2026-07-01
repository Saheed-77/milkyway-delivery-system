import { beforeEach, describe, expect, it } from "vitest";
import { addDays, toLocalISODate } from "@/lib/format";
import { mockApi as api, resetDemoData } from "./mockApi";
import { getStore } from "./store";

const plusDays = (n: number) => toLocalISODate(addDays(new Date(), n));

async function payFor(amount: number, purpose: "order" | "wallet_topup" = "order") {
  const order = await api.gateway.createOrder({ amount, purpose });
  await api.gateway.capture(order.id, { method: "upi", detail: "UPI · success@razorpay" });
  return order.id;
}

describe("simulated payment gateway", () => {
  beforeEach(async () => {
    resetDemoData();
    await api.auth.demoSignIn!("customer");
    getStore().db.stock[0]!.total_stock = 10_000; // keep stock out of the way
  });

  it("credits a wallet top-up exactly once", async () => {
    const before = await api.wallet.balance();
    const order = await api.gateway.createOrder({ amount: 500, purpose: "wallet_topup" });
    const payment = await api.gateway.capture(order.id, { method: "card", detail: "Visa •••• 1111" });
    expect(payment.status).toBe("captured");
    expect(payment.id).toMatch(/^pay_/);
    expect(await api.wallet.balance()).toBeCloseTo(before + 500);
    await expect(api.gateway.capture(order.id, { method: "card", detail: "Visa •••• 1111" })).rejects.toThrow(/already been processed/);
    expect(await api.wallet.balance()).toBeCloseTo(before + 500);
  });

  it("records failures without moving money and refuses full card numbers", async () => {
    const before = await api.wallet.balance();
    const order = await api.gateway.createOrder({ amount: 300, purpose: "wallet_topup" });
    await expect(api.gateway.capture(order.id, { method: "card", detail: "4111 1111 1111 1111" })).rejects.toThrow(/card or account numbers/);
    const failed = await api.gateway.fail(order.id, { method: "card", detail: "Visa •••• 0002", reason: "Card declined" });
    expect(failed.status).toBe("failed");
    expect(await api.wallet.balance()).toBeCloseTo(before);
  });

  it("places an online order only with a captured payment of the exact total, once", async () => {
    const gatewayOrderId = await payFor(120); // 2 L cow @ ₹60
    const id = await api.orders.place({ milkType: "cow", quantity: 2, paymentMethod: "online", gatewayOrderId });
    const order = (await api.orders.mine()).find((o) => o.id === id)!;
    expect(order.payment_method).toBe("online");
    expect(order.payment_ref).toMatch(/^pay_/);
    await expect(api.orders.place({ milkType: "cow", quantity: 2, paymentMethod: "online", gatewayOrderId })).rejects.toThrow(/already been used/);
    await expect(api.orders.place({ milkType: "cow", quantity: 1, paymentMethod: "online" })).rejects.toThrow(/Payment not found/);
  });

  it("refunds automatically when the amount doesn't match", async () => {
    const gatewayOrderId = await payFor(100);
    await expect(api.orders.place({ milkType: "cow", quantity: 2, paymentMethod: "online", gatewayOrderId })).rejects.toThrow(/refunded/);
    const payment = (await api.gateway.mine()).find((p) => p.gateway_order_id === gatewayOrderId)!;
    expect(payment.status).toBe("refunded");
  });

  it("refunds an online payment to source when the order is cancelled", async () => {
    const gatewayOrderId = await payFor(80);
    const id = await api.orders.place({ milkType: "buffalo", quantity: 1, paymentMethod: "online", gatewayOrderId });
    const walletBefore = await api.wallet.balance();
    await api.orders.cancel(id);
    const payment = (await api.gateway.mine()).find((p) => p.gateway_order_id === gatewayOrderId)!;
    expect(payment.status).toBe("refunded");
    expect(await api.wallet.balance()).toBeCloseTo(walletBefore); // refunded to UPI, not the wallet
  });
});

describe("delivery slots", () => {
  beforeEach(async () => {
    resetDemoData();
    await api.auth.demoSignIn!("customer");
    getStore().db.stock[0]!.total_stock = 10_000;
  });

  it("books a window and rejects full or closed ones", async () => {
    const slots = await api.slots.list(plusDays(1), 1);
    const slot = slots.find((s) => s.start === "19:00")!;
    const id = await api.orders.place({ milkType: "cow", quantity: 1, paymentMethod: "cash", slotId: slot.id });
    const order = (await api.orders.mine()).find((o) => o.id === id)!;
    expect(order.delivery_slot).toMatchObject({ date: plusDays(1), start: "19:00", end: "21:00" });
    expect((await api.slots.list(plusDays(1), 1)).find((s) => s.id === slot.id)!.booked).toBe(slot.booked + 1);

    const db = getStore().db.slots.find((s) => s.id === slot.id)!;
    db.capacity = slot.booked + 1; // now full
    await expect(api.orders.place({ milkType: "cow", quantity: 1, paymentMethod: "cash", slotId: slot.id })).rejects.toThrow(/filled up/);
    db.capacity = 50;
    db.is_active = false;
    await expect(api.orders.place({ milkType: "cow", quantity: 1, paymentMethod: "cash", slotId: slot.id })).rejects.toThrow(/isn't available/);
  });

  it("does not let admins shrink a slot below its bookings", async () => {
    const slot = (await api.slots.list(plusDays(1), 1)).find((s) => s.booked > 0)!;
    await api.auth.demoSignIn!("admin");
    await expect(api.slots.update(slot.id, { capacity: slot.booked - 1 || 0 })).rejects.toThrow();
    await api.slots.update(slot.id, { capacity: slot.booked + 3 });
    expect((await api.slots.list(plusDays(1), 1)).find((s) => s.id === slot.id)!.capacity).toBe(slot.booked + 3);
  });
});

describe("subscription skips and vacations", () => {
  beforeEach(async () => {
    resetDemoData();
    await api.auth.demoSignIn!("customer");
  });

  it("validates skip dates", async () => {
    const sub = (await api.subscriptions.mine())[0]!;
    await expect(api.subscriptions.setSkips(sub.id, [toLocalISODate()], true)).rejects.toThrow(/tomorrow onwards/);
    await expect(api.subscriptions.setSkips(sub.id, [plusDays(120)], true)).rejects.toThrow(/90 days/);
    const tooLong = Array.from({ length: 61 }, (_, i) => plusDays(i + 1));
    await expect(api.subscriptions.setSkips(sub.id, tooLong, true)).rejects.toThrow(/at most 60 days/);
  });

  it("skips billing and reservations on vacation days", async () => {
    getStore().db.subscriptionSkips = []; // start from a clean calendar
    const sub = (await api.subscriptions.mine()).find((s) => s.frequency === "daily" && s.status === "active")!;
    const tomorrow = plusDays(1);
    await api.subscriptions.setSkips(sub.id, [tomorrow, plusDays(2)], true);
    const after = (await api.subscriptions.mine()).find((s) => s.id === sub.id)!;
    expect(after.skip_dates).toEqual([tomorrow, plusDays(2)]);
    expect(after.next_delivery).toBe(plusDays(3));

    await api.auth.demoSignIn!("admin");
    const demandWith = await api.stock.reserveTomorrow();
    await api.subscriptions.generateOrders(tomorrow);
    const billed = getStore().db.orders.some((o) => o.subscription_id === sub.id && o.delivery_slot_id && getStore().db.slots.find((x) => x.id === o.delivery_slot_id)?.slot_date === tomorrow);
    expect(billed).toBe(false);

    await api.auth.demoSignIn!("customer");
    await api.subscriptions.setSkips(sub.id, [tomorrow], false);
    await api.auth.demoSignIn!("admin");
    expect(await api.stock.reserveTomorrow()).toBe(Math.ceil(demandWith + sub.quantity));
  });

  it("bills a due day into the preferred delivery window", async () => {
    const sub = (await api.subscriptions.mine()).find((s) => s.frequency === "daily" && s.status === "active")!;
    await api.subscriptions.update(sub.id, { preferred_slot_start: "17:00" });
    await api.auth.demoSignIn!("admin");
    await api.subscriptions.generateOrders(plusDays(1));
    const order = getStore().db.orders.find((o) => o.subscription_id === sub.id && o.delivery_slot_id);
    const slot = getStore().db.slots.find((x) => x.id === order?.delivery_slot_id);
    expect(slot).toMatchObject({ slot_date: plusDays(1), start_time: "17:00" });
  });
});
