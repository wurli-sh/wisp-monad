import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_NEXT = new Set([
  "/register",
  "/inbox",
  "/account",
  "/send",
]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next") ?? "/register";
  const next = ALLOWED_NEXT.has(nextParam) ? nextParam : "/register";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const destination = new URL("/register", url.origin);
      destination.searchParams.set("authError", "oauth_callback_failed");
      return NextResponse.redirect(destination);
    }
  } else {
    const destination = new URL("/register", url.origin);
    destination.searchParams.set("authError", "missing_oauth_code");
    return NextResponse.redirect(destination);
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
