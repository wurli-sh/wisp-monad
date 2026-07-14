"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  buildInboxKeyMessage,
  deriveInboxPubkeyFromSignature,
} from "@wisp/crypto/signature";
import { useConnect, useSignMessage, useSwitchChain } from "wagmi";
import { getAccount } from "@wagmi/core";
import { injected } from "wagmi/connectors";
import { monadTestnet } from "viem/chains";
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { TextShimmer } from "@/components/ui/TextShimmer";
import { wagmiConfig } from "@/lib/wagmi";
import type { ApiMeResponse } from "@/lib/api-contracts";

export function RegisterFlow() {
  const params = useSearchParams();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [me, setMe] = useState<ApiMeResponse | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [meLoading, setMeLoading] = useState(false);
  const sessionTokenRef = useRef<string | null>(null);

  const { connectAsync } = useConnect();
  const { switchChainAsync } = useSwitchChain();
  const { signMessageAsync } = useSignMessage();

  useEffect(() => {
    const supabase = createClient();
    const applySessionToken = (nextToken: string | null) => {
      if (sessionTokenRef.current !== nextToken) {
        sessionTokenRef.current = nextToken;
        setMeLoading(Boolean(nextToken));
        setSessionToken(nextToken);
      }
      setSessionLoaded(true);
    };
    supabase.auth
      .getSession()
      .then(({ data }) => {
        applySessionToken(data.session?.access_token ?? null);
      })
      .catch((e: unknown) => {
        setStatus(e instanceof Error ? e.message : "Failed to load session");
      })
      .finally(() => setSessionLoaded(true));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      applySessionToken(s?.access_token ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!sessionToken) {
      setMe(null);
      setMeLoading(false);
      return;
    }
    apiFetch<ApiMeResponse>("/v1/me", { token: sessionToken })
      .then(setMe)
      .catch((e: unknown) => {
        setMe(null);
        setStatus(e instanceof Error ? e.message : "Failed to load account");
      })
      .finally(() => setMeLoading(false));
  }, [sessionToken]);

  async function oauth(provider: "google" | "twitter") {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/register`,
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
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "email",
    });
    setBusy(false);
    if (error) setStatus(error.message);
  }

  async function linkWallet() {
    if (!sessionToken) return;
    setBusy(true);
    setStatus(null);
    try {
      if (!getAccount(wagmiConfig).address) {
        await connectAsync({ connector: injected() });
      }
      if (getAccount(wagmiConfig).chainId !== monadTestnet.id) {
        await switchChainAsync({ chainId: monadTestnet.id });
      }
      const connected = getAccount(wagmiConfig);
      if (!connected.address || connected.chainId !== monadTestnet.id) {
        throw new Error("Connect a wallet on Monad testnet");
      }
      const addr = connected.address;
      const challenge = await apiFetch<{ challenge: string; expiresAt: string }>(
        "/v1/wallet/challenge",
        {
          method: "POST",
          token: sessionToken,
          body: { address: addr, chainId: monadTestnet.id },
        },
      );
      const signature = await signMessageAsync({ message: challenge.challenge });
      const meData = await apiFetch<ApiMeResponse>("/v1/me", {
        token: sessionToken,
      });
      const inboxMsg = buildInboxKeyMessage(meData.userId, monadTestnet.id);
      const inboxSignature = await signMessageAsync({ message: inboxMsg });
      const inboxPubkey = deriveInboxPubkeyFromSignature(inboxSignature);
      await apiFetch("/v1/wallet/link", {
        method: "POST",
        token: sessionToken,
        body: {
          address: addr,
          chainId: monadTestnet.id,
          signature,
          challenge: challenge.challenge,
          inboxSignature,
          inboxPubkey,
        },
      });
      setStatus("Wallet linked. Opening inbox…");
      router.push("/inbox");
      router.refresh();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Wallet link failed");
    } finally {
      setBusy(false);
    }
  }

  const preferred = params.get("provider");
  const authError = params.get("authError");

  useEffect(() => {
    if (preferred === "google") void oauth("google");
    if (preferred === "x") void oauth("twitter");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!sessionLoaded || (sessionToken && meLoading)) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <TextShimmer>Loading account…</TextShimmer>
      </div>
    );
  }

  if (sessionToken && me?.wallet) {
    return (
      <div className="mx-auto max-w-lg space-y-4 text-center">
        <h1 className="text-3xl font-bold">You are registered</h1>
        <p className="text-muted-foreground">Wallet and inbox key are linked.</p>
        <Button onClick={() => router.push("/inbox")}>Open inbox</Button>
      </div>
    );
  }

  if (sessionToken) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <h1 className="text-3xl font-bold">Link your wallet</h1>
        <p className="text-muted-foreground">
          Sign a one-time challenge and an inbox-key message. Wisp never stores your
          private key.
        </p>
        <Button disabled={busy} onClick={linkWallet}>
          {busy ? <TextShimmer>Linking…</TextShimmer> : "Connect & link wallet"}
        </Button>
        {status && <p className="text-sm text-destructive">{status}</p>}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-3xl font-bold">Create your Wisp account</h1>
      {authError && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          Sign-in did not complete. Please try again.
        </p>
      )}
      <p className="text-muted-foreground">
        Continue with Google, X, or email. X handles are verified via OAuth — there is
        no free-form claim field.
      </p>
      <div className="flex flex-col gap-3">
        <Button disabled={busy} variant="outline" onClick={() => oauth("google")}>
          Continue with Google
        </Button>
        <Button disabled={busy} variant="outline" onClick={() => oauth("twitter")}>
          Continue with X
        </Button>
      </div>
      <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <p className="text-sm font-semibold">Email OTP</p>
        <input
          className="w-full rounded-xl border-2 border-border bg-background px-4 py-3"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {!otpSent ? (
          <Button disabled={busy || !email} onClick={sendOtp}>
            Send code
          </Button>
        ) : (
          <>
            <input
              className="w-full rounded-xl border-2 border-border bg-background px-4 py-3"
              placeholder="One-time code"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
            />
            <Button disabled={busy || !otp} onClick={verifyOtp}>
              Verify
            </Button>
          </>
        )}
      </div>
      {status && <p className="text-sm text-muted-foreground">{status}</p>}
    </div>
  );
}
