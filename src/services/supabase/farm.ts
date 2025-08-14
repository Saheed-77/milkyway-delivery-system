import * as rpc from "@/lib/rpc";
import { round2, toLocalISODate } from "@/lib/format";
import { getSupabase } from "@/integrations/supabase/client";
import type { DataApi } from "../api";
import { MILK_TYPES, type MilkPrice, type MilkType } from "../types";
import {
  CONTRIBUTION_SELECT,
  currentUserId,
  FARMER_SELECT,
  mapContribution,
  mapFarmer,
  mapPayment,
  must,
  PAYMENT_SELECT,
  priceResolver,
  pricingHistory,
  sb,
} from "./shared";

export const farmers: DataApi["farmers"] = {
  async list() {
    const rows = must(
      await sb().from("profiles").select(FARMER_SELECT).eq("user_type", "farmer").order("created_at", { ascending: false })
    );
    return rows.map(mapFarmer);
  },
  async me() {
    const uid = await currentUserId();
    const row = must(await sb().from("profiles").select(FARMER_SELECT).eq("id", uid).maybeSingle());
    return row && row.user_type === "farmer" ? mapFarmer(row) : null;
  },
  async setStatus(farmerId, status) {
    await rpc.setFarmerStatus(farmerId, status);
  },
  async create(input) {
    // Creating another user needs the service role, so this runs in an Edge
    // Function (supabase/functions/admin-create-farmer) that verifies the
    // caller is an admin. Calling auth.signUp here would replace the admin's
    // own session.
    const { data, error } = await getSupabase().functions.invoke("admin-create-farmer", { body: input });
    if (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const detail = await (error as any).context?.json?.().catch(() => null);
      throw new Error(detail?.error ?? error.message);
    }
    const row = must(await sb().from("profiles").select(FARMER_SELECT).eq("id", data.id).single());
    return mapFarmer(row);
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rangeQuery(q: any, range?: { from?: string; to?: string }): any {
  let next = q;
  if (range?.from) next = next.gte("contribution_date", range.from);
  if (range?.to) next = next.lte("contribution_date", range.to); // inclusive end date
  return next;
}

export const contributions: DataApi["contributions"] = {
  async mine(range) {
    const uid = await currentUserId();
    const [history, rows] = await Promise.all([
      pricingHistory(),
      rangeQuery(
        sb().from("milk_contributions").select(CONTRIBUTION_SELECT).eq("farmer_id", uid),
        range
      ).order("contribution_date", { ascending: false }).then(must),
    ]);
    const priceOn = priceResolver(history);
    return rows.map((r) => mapContribution(r, priceOn));
  },
  async all(range) {
    const [history, rows] = await Promise.all([
      pricingHistory(),
      rangeQuery(sb().from("milk_contributions").select(CONTRIBUTION_SELECT), range)
        .order("contribution_date", { ascending: false })
        .limit(2000)
        .then(must),
    ]);
    const priceOn = priceResolver(history);
    return rows.map((r) => mapContribution(r, priceOn));
  },
  async submitCollection(input) {
    return rpc.submitMilkCollection({
      farmerCode: input.farmerCode,
      quantity: input.quantity,
      qualityRating: input.qualityRating,
      milkType: input.milkType,
    });
  },
};

export const payments: DataApi["payments"] = {
  async mine() {
    const uid = await currentUserId();
    const rows = must(
      await sb().from("farmer_payments").select(PAYMENT_SELECT).eq("farmer_id", uid).order("created_at", { ascending: false })
    );
    return rows.map(mapPayment);
  },
  async all() {
    const rows = must(await sb().from("farmer_payments").select(PAYMENT_SELECT).order("created_at", { ascending: false }));
    return rows.map(mapPayment);
  },
  async pendingValue() {
    const uid = await currentUserId();
    const [history, rows] = await Promise.all([
      pricingHistory(),
      sb()
        .from("milk_contributions")
        .select("quantity, milk_type, contribution_date")
        .eq("farmer_id", uid)
        .is("payment_id", null)
        .then(must),
    ]);
    const priceOn = priceResolver(history);
    return {
      liters: round2(rows.reduce((s, c) => s + Number(c.quantity), 0)),
      amount: round2(rows.reduce((s, c) => s + Number(c.quantity) * priceOn(c.milk_type as MilkType, c.contribution_date), 0)),
    };
  },
  request: () => rpc.requestFarmerPayment(),
  async review(paymentId, approve) {
    await rpc.reviewFarmerPayment(paymentId, approve);
  },
};

export const pricing: DataApi["pricing"] = {
  async current() {
    const today = toLocalISODate();
    const history = (await pricingHistory()).filter((p) => p.effective_from <= today);
    const result = {} as Record<MilkType, MilkPrice | null>;
    for (const m of MILK_TYPES) result[m] = history.find((p) => p.milk_type === m) ?? null;
    return result;
  },
  history: pricingHistory,
  async set(prices) {
    const today = toLocalISODate();
    const rows = (Object.entries(prices) as [MilkType, number | undefined][])
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([milk_type, price]) => {
        if (!(Number(price) > 0) || Number(price) > 10000) throw new Error(`Enter a valid ${milk_type} price`);
        return { milk_type, price_per_liter: round2(Number(price)), effective_from: today };
      });
    if (!rows.length) return;
    // New rows effective today; earlier prices stay for date-based farmer pay.
    must(await sb().from("milk_pricing").upsert(rows, { onConflict: "milk_type,effective_from" }).select("id"));
  },
};
