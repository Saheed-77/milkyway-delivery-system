/**
 * Query fragments and row → domain mappers for the live (Supabase) backend.
 *
 * `orders` has two foreign keys to `profiles` (customer_id and
 * delivery_person_id), so embeds must name the column; an unqualified
 * `profiles(...)` embed is ambiguous and PostgREST rejects it (PGRST201).
 */
import { getSupabase } from "@/integrations/supabase/client";
import { fullName, round2 } from "@/lib/format";
import type {
  Contribution,
  Farmer,
  FarmerPayment,
  MilkPrice,
  MilkType,
  Order,
  Profile,
} from "../types";

export const sb = () => getSupabase();

/** Unwrap a Supabase response, throwing its message. */
export function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export async function currentUserId(): Promise<string> {
  const { data } = await sb().auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("Not authenticated");
  return id;
}

export const PROFILE_COLUMNS =
  "id, email, user_type, status, first_name, last_name, phone, address, latitude, longitude, created_at";

export const ORDER_SELECT = `
  id, customer_id, total_amount, status, payment_method, delivery_person_id,
  delivery_address, delivery_lat, delivery_lng, delivery_notes,
  assigned_at, picked_up_at, delivered_at, created_at, source,
  customer:profiles!customer_id ( first_name, last_name, phone ),
  rider:profiles!delivery_person_id ( first_name, last_name ),
  order_items ( product_id, quantity, unit_price, products ( name, milk_type ) )
`;

export const ORDER_SELECT_WITH_OTP = `${ORDER_SELECT}, order_otps ( otp )`;

type Named = { first_name: string | null; last_name: string | null; phone?: string | null } | null;
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapOrder(row: any): Order {
  const customer = one<Named>(row.customer);
  const rider = one<Named>(row.rider);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (row.order_items ?? []).map((i: any) => {
    const product = one<{ name: string; milk_type: MilkType }>(i.products);
    return {
      product_id: i.product_id,
      product_name: product?.name ?? "Milk",
      milk_type: product?.milk_type ?? "cow",
      quantity: Number(i.quantity),
      unit_price: Number(i.unit_price),
    };
  });
  const otp = one<{ otp: string }>(row.order_otps);
  return {
    id: row.id,
    customer_id: row.customer_id,
    customer_name: fullName(customer),
    customer_phone: customer?.phone ?? null,
    total_amount: Number(row.total_amount),
    status: row.status,
    payment_method: row.payment_method,
    delivery_person_id: row.delivery_person_id,
    rider_name: rider ? fullName(rider) : null,
    delivery_address: row.delivery_address ?? null,
    delivery_lat: row.delivery_lat ?? null,
    delivery_lng: row.delivery_lng ?? null,
    delivery_notes: row.delivery_notes ?? null,
    delivery_otp: otp?.otp ?? null,
    assigned_at: row.assigned_at ?? null,
    picked_up_at: row.picked_up_at ?? null,
    delivered_at: row.delivered_at ?? null,
    created_at: row.created_at,
    items,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    quantity: items.reduce((s: number, i: any) => s + i.quantity, 0),
    source: row.source ?? "order",
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapProfile(row: any): Profile {
  return {
    id: row.id,
    email: row.email,
    user_type: row.user_type,
    status: row.status,
    first_name: row.first_name,
    last_name: row.last_name,
    phone: row.phone,
    address: row.address,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    created_at: row.created_at,
  };
}

export const FARMER_SELECT = `${PROFILE_COLUMNS}, farmers ( farmer_id, farm_name, farm_location, production_capacity )`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapFarmer(row: any): Farmer {
  const f = one<{ farmer_id: number; farm_name: string; farm_location: string | null; production_capacity: number | null }>(
    row.farmers
  );
  return {
    id: row.id,
    farmer_code: f?.farmer_id ?? 0,
    first_name: row.first_name,
    last_name: row.last_name,
    name: fullName(row),
    email: row.email,
    phone: row.phone,
    status: row.status,
    farm_name: f?.farm_name ?? "Unnamed Farm",
    farm_location: f?.farm_location ?? null,
    production_capacity: f?.production_capacity ?? null,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    created_at: row.created_at,
  };
}

/** Price effective on a date, from a full pricing history. */
export function priceResolver(history: MilkPrice[]) {
  const sorted = [...history].sort((a, b) => b.effective_from.localeCompare(a.effective_from));
  return (milk: MilkType, date: string) =>
    sorted.find((p) => p.milk_type === milk && p.effective_from <= date)?.price_per_liter ?? 0;
}

export async function pricingHistory(): Promise<MilkPrice[]> {
  const rows = must(
    await sb().from("milk_pricing").select("id, milk_type, price_per_liter, effective_from").order("effective_from", { ascending: false })
  );
  return rows.map((r) => ({ ...r, milk_type: r.milk_type as MilkType, price_per_liter: Number(r.price_per_liter) }));
}

export const CONTRIBUTION_SELECT = `
  id, farmer_id, quantity, milk_type, quality_rating, contribution_date, payment_id, created_at,
  farmer:profiles!farmer_id ( first_name, last_name, farmers ( farmer_id ) ),
  payment:farmer_payments!payment_id ( status )
`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapContribution(row: any, priceOn: (m: MilkType, d: string) => number): Contribution {
  const farmer = one<{ first_name: string | null; last_name: string | null; farmers: unknown }>(row.farmer);
  const code = one<{ farmer_id: number }>(farmer?.farmers as never);
  const payment = one<{ status: string }>(row.payment);
  const quantity = Number(row.quantity);
  return {
    id: row.id,
    farmer_id: row.farmer_id,
    farmer_name: fullName(farmer),
    farmer_code: code?.farmer_id ?? null,
    quantity,
    milk_type: row.milk_type,
    quality_rating: row.quality_rating,
    contribution_date: row.contribution_date,
    payment_id: row.payment_id,
    payment_status: (payment?.status as Contribution["payment_status"]) ?? null,
    value: round2(quantity * priceOn(row.milk_type, row.contribution_date)),
    created_at: row.created_at,
  };
}

export const PAYMENT_SELECT = `
  id, farmer_id, amount, status, payment_date, approved_at, created_at,
  farmer:profiles!farmer_id ( first_name, last_name, farmers ( farmer_id ) ),
  milk_contributions ( quantity )
`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapPayment(row: any): FarmerPayment {
  const farmer = one<{ first_name: string | null; last_name: string | null; farmers: unknown }>(row.farmer);
  const code = one<{ farmer_id: number }>(farmer?.farmers as never);
  const rows: { quantity: number }[] = row.milk_contributions ?? [];
  return {
    id: row.id,
    farmer_id: row.farmer_id,
    farmer_name: fullName(farmer),
    farmer_code: code?.farmer_id ?? null,
    amount: Number(row.amount),
    status: row.status,
    payment_date: row.payment_date,
    approved_at: row.approved_at,
    created_at: row.created_at,
    liters: round2(rows.reduce((s, c) => s + Number(c.quantity), 0)),
    contribution_count: rows.length,
  };
}
