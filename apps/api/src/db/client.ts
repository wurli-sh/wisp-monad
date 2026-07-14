import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AppConfig } from "../config.ts";

export type Db = SupabaseClient;

export function createDb(config: AppConfig): Db {
  return createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function pingDb(db: Db): Promise<boolean> {
  const { error } = await db.from("profiles").select("id").limit(1);
  return !error;
}
