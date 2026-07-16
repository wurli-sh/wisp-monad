import type { Provider } from "@supabase/supabase-js";

export type WispOAuthProvider = "google" | "x";

/** auth-js 2.70 types predate GoTrue's X OAuth 2.0 provider identifier. */
export function toSupabaseProvider(provider: WispOAuthProvider): Provider {
  return provider as Provider;
}
