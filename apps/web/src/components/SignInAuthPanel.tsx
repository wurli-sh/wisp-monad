"use client";

import { useState } from "react";
import { BadgeCheck, Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { GoogleIcon, XBrandIcon } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";
import {
  toSupabaseProvider,
  type WispOAuthProvider,
} from "@/lib/supabase/providers";
import { cn } from "@/lib/cn";

type Props = {
  redirectNext?: string;
  authError?: boolean;
  className?: string;
  onAuthenticated?: () => void;
};

export function SignInAuthPanel({
  redirectNext = "/account",
  authError = false,
  className,
  onAuthenticated,
}: Props) {
  const [email, setEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function oauth(provider: WispOAuthProvider) {
    setBusy(true);
    setStatus(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: toSupabaseProvider(provider),
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectNext)}`,
      },
    });
    if (error) setStatus(error.message);
    setBusy(false);
  }

  async function sendOtp() {
    setBusy(true);
    setStatus(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({ email });
    setBusy(false);
    if (error) {
      setStatus(error.message);
      return;
    }
    setOtpSent(true);
    setStatus("Check your email for a one-time code.");
  }

  async function verifyOtp() {
    setBusy(true);
    setStatus(null);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "email",
    });
    setBusy(false);
    if (error) {
      setStatus(error.message);
      return;
    }
    onAuthenticated?.();
  }

  return (
    <div className={cn("space-y-5", className)}>
      {authError && (
        <p className="radius-surface-inner border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          Sign-in did not complete. Please try again.
        </p>
      )}
      <div className="flex flex-col gap-3">
        <Button
          disabled={busy}
          variant="outline"
          onClick={() => void oauth("google")}
        >
          <GoogleIcon className="h-4 w-4" />
          Continue with Google
        </Button>
        <Button
          disabled={busy}
          variant="outline"
          onClick={() => void oauth("x")}
        >
          <XBrandIcon className="h-4 w-4" />
          Continue with X
        </Button>
      </div>
      <div className="space-y-3 border-t border-border/70 pt-5">
        <p className="text-sm font-medium text-foreground">Email</p>
        <input
          className="radius-control w-full border border-border/70 bg-muted px-4 py-3 text-sm outline-none transition-[border-color,box-shadow] duration-100 ease-out focus:border-brand focus:ring-2 focus:ring-ring/30"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        {!otpSent ? (
          <Button disabled={busy || !email} onClick={() => void sendOtp()}>
            <Mail className="h-4 w-4" aria-hidden="true" />
            Send code
          </Button>
        ) : (
          <>
            <input
              className="radius-control w-full border border-border/70 bg-muted px-4 py-3 text-sm outline-none transition-[border-color,box-shadow] duration-100 ease-out focus:border-brand focus:ring-2 focus:ring-ring/30"
              placeholder="One-time code"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              autoComplete="one-time-code"
            />
            <Button disabled={busy || !otp} onClick={() => void verifyOtp()}>
              <BadgeCheck className="h-4 w-4" aria-hidden="true" />
              Verify
            </Button>
          </>
        )}
      </div>
      {status && <p className="text-sm text-muted-foreground">{status}</p>}
    </div>
  );
}
