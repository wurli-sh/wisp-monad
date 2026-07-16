import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_PATHS = new Set([
  "/register",
  "/inbox",
  "/account",
  "/send",
]);

function resolveNext(nextParam: string, origin: string): string {
  try {
    const url = new URL(nextParam, origin);
    if (url.origin !== new URL(origin).origin) {
      return "/account?tab=wallet";
    }
    if (!ALLOWED_PATHS.has(url.pathname)) {
      return "/account?tab=wallet";
    }
    return `${url.pathname}${url.search}`;
  } catch {
    return "/account?tab=wallet";
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next") ?? "/account?tab=wallet";
  const next = resolveNext(nextParam, url.origin);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const destination = new URL("/account", url.origin);
      destination.searchParams.set("tab", "wallet");
      destination.searchParams.set("authError", "oauth_callback_failed");
      return NextResponse.redirect(destination);
    }
  } else {
    const destination = new URL("/account", url.origin);
    destination.searchParams.set("tab", "wallet");
    destination.searchParams.set("authError", "missing_oauth_code");
    return NextResponse.redirect(destination);
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
