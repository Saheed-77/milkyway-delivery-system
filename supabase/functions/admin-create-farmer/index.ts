// Supabase Edge Function: admin-create-farmer
//
// Creating another user's account needs the service role, which must never
// reach the browser. The old client-side implementation called auth.signUp
// from the admin's session (silently signing the admin out), inserted a
// duplicate farmers row and wrote a GENERATED ALWAYS column.
//
// Deploy:  supabase functions deploy admin-create-farmer
// Secrets: SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are
//          injected automatically by Supabase.
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

interface Payload {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  farmName?: string;
  farmLocation?: string;
  productionCapacity?: number | null;
}

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // 1. Verify the caller is a signed-in admin (RLS-scoped client with their JWT).
  const authHeader = req.headers.get("Authorization") ?? "";
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: isAdmin, error: roleError } = await caller.rpc("is_admin");
  if (roleError || isAdmin !== true) return json({ error: "Only admins can register farmers" }, 403);

  // 2. Validate input.
  let body: Payload;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const email = clean(body.email, 254).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  const firstName = clean(body.firstName, 100);
  const lastName = clean(body.lastName, 100);
  const farmName = clean(body.farmName, 200);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Enter a valid email address" }, 400);
  if (password.length < 8) return json({ error: "Temporary password must be at least 8 characters" }, 400);
  if (!firstName || !lastName) return json({ error: "First and last name are required" }, 400);
  if (!farmName) return json({ error: "Farm name is required" }, 400);
  const capacity =
    body.productionCapacity === null || body.productionCapacity === undefined ? null : Number(body.productionCapacity);
  if (capacity !== null && (!Number.isFinite(capacity) || capacity < 0)) return json({ error: "Invalid production capacity" }, 400);

  // 3. Create the user with the service role. The on_auth_user_created
  //    trigger creates the profile + farmers row from this metadata.
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      user_type: "farmer",
      first_name: firstName,
      last_name: lastName,
      phone: clean(body.phone, 20),
      farm_name: farmName,
      farm_location: clean(body.farmLocation, 500),
    },
  });
  if (createError || !created.user) {
    const msg = createError?.message ?? "Could not create the account";
    return json({ error: /already/i.test(msg) ? "A user with this email already exists" : msg }, 400);
  }

  const id = created.user.id;

  // 4. Admin-registered farmers are approved immediately.
  const { error: approveError } = await admin.from("profiles").update({ status: "approved" }).eq("id", id);
  if (approveError) return json({ error: approveError.message }, 500);
  if (capacity !== null) {
    await admin.from("farmers").update({ production_capacity: capacity }).eq("id", id);
  }

  return json({ id });
});
