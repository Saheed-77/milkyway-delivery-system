/**
 * The app's single data entry point. Picks the in-browser demo backend or the
 * live Supabase backend at startup (see config/env.ts).
 */
import { IS_DEMO } from "@/config/env";
import type { DataApi } from "./api";
import { mockApi } from "./mock/mockApi";
import { supabaseApi } from "./supabase";

export const api: DataApi = IS_DEMO ? mockApi : supabaseApi;

export type { DataApi, ChangeTopic } from "./api";
export * from "./types";
