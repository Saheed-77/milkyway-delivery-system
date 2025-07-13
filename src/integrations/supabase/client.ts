import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { IS_DEMO, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/config/env";

let client: SupabaseClient<Database> | null = null;

/**
 * Lazily created Supabase client. In demo mode there is no backend, so
 * touching the client is a programming error — the demo service layer must
 * be used instead.
 */
export function getSupabase(): SupabaseClient<Database> {
  if (IS_DEMO) {
    throw new Error("Supabase is not configured (demo mode). Use the service layer.");
  }
  if (!client) {
    client = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}

/**
 * Backwards-compatible proxy so `supabase.from(...)` keeps working while the
 * client is created on first use rather than at import time.
 */
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop) {
    const c = getSupabase();
    const value = Reflect.get(c, prop, c);
    return typeof value === "function" ? value.bind(c) : value;
  },
});
