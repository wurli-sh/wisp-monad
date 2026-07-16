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
import { Inbox, Wallet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PageShell } from "@/components/PageShell";
import { SignInAuthPanel } from "@/components/SignInAuthPanel";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import {
  toSupabaseProvider,
  type WispOAuthProvider,
} from "@/lib/supabase/providers";
import { TextShimmer } from "@/components/ui/TextShimmer";
import { AccountSkeleton } from "@/components/ui/Skeleton";
import { wagmiConfig } from "@/lib/wagmi";
import type { ApiMeResponse } from "@/lib/api-contracts";

export function RegisterFlow() {
  const params = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [me, setMe] = useState<ApiMeResponse | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [meLoading, setMeLoading] = useState(false);
  const sessionTokenRef = useRef<string | null>(null);
  const oauthStarted = useRef(false);

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

  async function oauth(provider: WispOAuthProvider) {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: toSupabaseProvider(provider),
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/register`,
      },
    });
    if (error) setStatus(error.message);
    setBusy(false);
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
    if (oauthStarted.current || sessionToken) return;
    if (preferred === "google") {
      oauthStarted.current = true;
      void oauth("google");
    }
    if (preferred === "x") {
      oauthStarted.current = true;
      void oauth("x");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken]);

  if (!sessionLoaded || (sessionToken && meLoading)) {
    return <AccountSkeleton />;
  }

  if (sessionToken && me?.wallet) {
    return (
      <PageShell
        title="You’re in."
        subtitle="Wallet and inbox are linked."
        maxWidth="sm"
      >
        <div className="flex justify-center">
          <Button onClick={() => router.push("/inbox")}>
            <Inbox className="h-4 w-4" aria-hidden="true" />
            Open inbox
          </Button>
        </div>
      </PageShell>
    );
  }

  if (sessionToken) {
    return (
      <PageShell
        title="Link your wallet"
        subtitle="One signature to link your wallet. We never hold your keys."
        maxWidth="sm"
      >
        <div className="flex flex-col items-center gap-4">
          <Button disabled={busy} onClick={() => void linkWallet()}>
            {busy ? (
              <TextShimmer>Linking…</TextShimmer>
            ) : (
              <>
                <Wallet className="h-4 w-4" aria-hidden="true" />
                Connect & link wallet
              </>
            )}
          </Button>
          {status && <p className="text-sm text-destructive">{status}</p>}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Create your Wisp account"
      subtitle="Continue with Google, X, or email. That’s your Wisp handle."
      maxWidth="sm"
    >
      <div className="radius-surface border border-border/80 bg-card p-6 shadow-card sm:p-8">
        <SignInAuthPanel
          authError={Boolean(authError)}
          onAuthenticated={() => router.refresh()}
        />
        {status && <p className="mt-4 text-sm text-muted-foreground">{status}</p>}
      </div>
    </PageShell>
  );
}
