import { beforeEach, describe, expect, it } from "vitest";
import { mockApi as api, resetDemoData } from "./mockApi";
import { getStore } from "./store";

/** The demo backend must enforce the same rules as the Postgres RPCs. */
describe("demo backend business rules", () => {
  beforeEach(async () => {
    resetDemoData();
    await api.auth.signOut();
  });

  it("rejects unauthenticated calls", async () => {
    await expect(api.wallet.balance()).rejects.toThrow("Not authenticated");
  });

  it("debits the wallet and stock when an order is placed, and refunds on cancel", async () => {
    await api.auth.demoSignIn!("customer");
    const before = await api.wallet.balance();
    const stockBefore = getStore().db.stock[0]!.total_stock;

    const id = await api.orders.place({ milkType: "cow", quantity: 2, paymentMethod: "wallet" });
    expect(await api.wallet.balance()).toBeCloseTo(before - 120); // 2 L × ₹60
    expect(getStore().db.stock[0]!.total_stock).toBeCloseTo(stockBefore - 2);

    await api.orders.cancel(id);
    expect(await api.wallet.balance()).toBeCloseTo(before);
    expect(getStore().db.stock[0]!.total_stock).toBeCloseTo(stockBefore);
    await expect(api.orders.cancel(id)).rejects.toThrow("Only pending orders");
  });

  it("refuses orders the wallet can't cover", async () => {
    await api.auth.demoSignIn!("customer");
    const balance = await api.wallet.balance();
    const liters = Math.min(100, Math.ceil(balance / 120) + 1); // goat milk is ₹120/L
    getStore().db.stock[0]!.total_stock = 10_000;
    await expect(api.orders.place({ milkType: "goat", quantity: liters, paymentMethod: "wallet" })).rejects.toThrow(
      /Insufficient wallet balance/
    );
  });

  it("only completes a delivery with the customer's OTP", async () => {
    await api.auth.demoSignIn!("delivery");
    const { assigned } = await api.delivery.myStops();
    const order = assigned[0]!;
    const otp = getStore().db.orders.find((o) => o.id === order.id)!.delivery_otp;

    expect(order.delivery_otp).toBeNull(); // riders never see the code
    await expect(api.delivery.complete(order.id, otp === "0000" ? "1111" : "0000")).rejects.toThrow(/Incorrect delivery code/);
    await api.delivery.complete(order.id, otp);
    expect(getStore().db.orders.find((o) => o.id === order.id)!.status).toBe("completed");
  });

  it("blacklists a farmer after three consecutive substandard collections", async () => {
    await api.auth.demoSignIn!("delivery");
    const input = { farmerCode: 1002, quantity: 20, milkType: "cow" as const };
    await api.contributions.submitCollection({ ...input, qualityRating: 1 });
    expect((await api.contributions.submitCollection({ ...input, qualityRating: 3 })).outcome).toBe("substandard");
    expect((await api.contributions.submitCollection({ ...input, qualityRating: 3 })).outcome).toBe("substandard");
    const third = await api.contributions.submitCollection({ ...input, qualityRating: 3 });
    expect(third).toMatchObject({ outcome: "blacklisted", offense_count: 3 });
    await expect(api.contributions.submitCollection({ ...input, qualityRating: 1 })).rejects.toThrow(/not approved/);
  });

  it("pays farmers at the price in effect on each collection date", async () => {
    await api.auth.demoSignIn!("farmer");
    const pending = await api.payments.pendingValue();
    expect(pending.amount).toBeGreaterThan(0);
    const paymentId = await api.payments.request();
    expect((await api.payments.pendingValue()).amount).toBe(0);

    await api.auth.demoSignIn!("admin");
    await api.pricing.set({ cow: 99 }); // a new price today must not change past value
    await api.payments.review(paymentId, true);

    await api.auth.demoSignIn!("farmer");
    const paid = (await api.payments.mine()).find((p) => p.id === paymentId)!;
    expect(paid.status).toBe("approved");
    expect(paid.amount).toBeCloseTo(pending.amount);
    const credit = (await api.wallet.transactions()).find((t) => t.description === "Milk contribution payment");
    expect(credit?.amount).toBeCloseTo(pending.amount);
  });

  it("keeps pricing history instead of overwriting it", async () => {
    await api.auth.demoSignIn!("admin");
    const before = (await api.pricing.history()).length;
    await api.pricing.set({ buffalo: 65 });
    const history = await api.pricing.history();
    expect(history.length).toBe(before + 1);
    expect((await api.pricing.current()).buffalo?.price_per_liter).toBe(65);
    await expect(api.pricing.set({ goat: 0 })).rejects.toThrow(/valid goat price/);
  });

  it("auto-assigns waiting orders to the nearest rider with capacity", async () => {
    await api.auth.demoSignIn!("admin");
    const waiting = getStore().db.orders.filter((o) => o.status === "pending" && !o.delivery_person_id).length;
    expect(waiting).toBeGreaterThan(0);
    expect(await api.delivery.autoAssign()).toBe(waiting);
    expect(getStore().db.orders.some((o) => o.status === "pending" && !o.delivery_person_id)).toBe(false);
  });
});
