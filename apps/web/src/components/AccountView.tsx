"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Check, Copy, ExternalLink, Link2Off, Mail, RefreshCw, X } from "lucide-react";
import { ApiClientError, apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { toSupabaseProvider } from "@/lib/supabase/providers";
import { Button } from "@/components/ui/Button";
import { GoogleIcon, XBrandIcon } from "@/components/icons";
import { PageShell } from "@/components/PageShell";
import { AccountSkeleton } from "@/components/ui/Skeleton";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { LinkWalletPanel } from "@/components/LinkWalletPanel";
import { addressExplorerUrl } from "@/lib/wagmi";
import {
  normalizeMeResponse,
  type ApiMeResponse,
  type MeResponse,
} from "@/lib/api-contracts";

function ProviderIcon({ provider }: { provider: string }) {
  const className = "h-4 w-4 shrink-0 text-muted-foreground";
  if (provider === "google") return <GoogleIcon className={className} />;
  if (provider === "x") return <XBrandIcon className={className} />;
  return <Mail className={className} aria-hidden="true" />;
}

type AccountTab = "handles" | "wallet";

function parseTab(raw: string | null): AccountTab {
  return raw === "wallet" ? "wallet" : "handles";
}

export function AccountView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = parseTab(params.get("tab"));

  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [copied, setCopied] = useState(false);

  const setTab = useCallback(
    (next: AccountTab) => {
      const qs = new URLSearchParams(params.toString());
      if (next === "handles") qs.delete("tab");
      else qs.set("tab", next);
      qs.delete("provider");
      const search = qs.toString();
      router.replace(search ? `${pathname}?${search}` : pathname, {
        scroll: false,
      });
    },
    [params, pathname, router],
  );

  async function refresh(t: string) {
    const data = await apiFetch<ApiMeResponse>("/v1/me", { token: t });
    setMe(normalizeMeResponse(data));
    setError(null);
  }

  useEffect(() => {
    const supabase = createClient();
    supabase.auth
      .getSession()
      .then(({ data }) => {
        const t = data.session?.access_token ?? null;
        setToken(t);
        if (t) return refresh(t);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Failed to load account");
      })
      .finally(() => setLoaded(true));
  }, []);

  async function unlink(id: string) {
    if (!token || busy) return;
    if ((me?.handles.length ?? 0) <= 1) {
      toast.info("Link another identity first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/v1/handles/${id}`, { method: "DELETE", token });
      await refresh(token);
    } catch (e) {
      if (e instanceof ApiClientError && e.code === "last_login_method") {
        toast.info("Link another identity first.");
        return;
      }
      setError(e instanceof Error ? e.message : "Unlink failed");
    } finally {
      setBusy(false);
    }
  }

  async function linkX() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: linkError } = await supabase.auth.linkIdentity({
        provider: toSupabaseProvider("x"),
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/account")}`,
        },
      });
      if (linkError) throw linkError;
    } catch (e) {
      setError(e instanceof Error ? e.message : "X account link failed");
    } finally {
      setBusy(false);
    }
  }

  async function copyAddress(address: string) {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    toast.success("Address copied");
    window.setTimeout(() => setCopied(false), 1800);
  }

  if (!loaded) {
    return <AccountSkeleton />;
  }

  if (!token) {
    return (
      <PageShell
        title="Account"
        subtitle="Sign in from the navigation to manage your handles and wallet."
        maxWidth="md"
      >
        {null}
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Account"
      subtitle="Your handles and linked wallet."
      maxWidth="md"
    >
      <div className="mb-6 flex justify-center">
        <SegmentedTabs
          items={[
            { value: "handles", label: "Handles" },
            { value: "wallet", label: "Wallet" },
          ]}
          value={tab}
          onValueChange={setTab}
          ariaLabel="Account sections"
          layoutId="account-sections"
          itemClassName="px-4 py-2"
        />
      </div>

      {tab === "handles" && (
        <section className="radius-surface overflow-hidden border border-border/80 bg-card shadow-card">
          <div className="border-b border-border/70 px-5 py-4 sm:px-6">
            <h2 className="text-sm font-semibold text-foreground">
              Connected identities
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              X is verified — no free-form @handles.
            </p>
          </div>
          <div className="space-y-4 p-5 sm:p-6">
            {me?.handles.length ? (
              <ul className="space-y-3">
                {me.handles.map((h) => (
                  <li
                    key={h.id}
                    className="radius-surface-inner flex items-center justify-between gap-3 border border-border/70 px-4 py-3"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted">
                        <ProviderIcon provider={h.provider} />
                      </span>
                      <div className="min-w-0">
                        <p className="break-all text-sm font-medium text-foreground">
                          {h.display}
                        </p>
                        <p className="mt-0.5 text-xs uppercase tracking-wide text-muted-foreground">
                          {h.provider === "x" ? "X" : h.provider}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      aria-disabled={me.handles.length <= 1}
                      onClick={() => void unlink(h.id)}
                    >
                      <Link2Off className="h-4 w-4" aria-hidden="true" />
                      Unlink
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="radius-surface-inner border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                No identities linked yet.
              </p>
            )}
            {!me?.handles.some((handle) => handle.provider === "x") && (
              <Button
                className="w-full"
                variant="secondary"
                disabled={busy}
                onClick={() => void linkX()}
              >
                <XBrandIcon className="h-4 w-4" />
                Link X account
              </Button>
            )}
          </div>
        </section>
      )}

      {tab === "wallet" && (
        <section className="radius-surface overflow-hidden border border-border/80 bg-card shadow-card">
          <div className="border-b border-border/70 px-5 py-4 sm:px-6">
            <h2 className="text-sm font-semibold text-foreground">
              Wallet connection
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              This wallet unlocks your private inbox.
            </p>
          </div>
          <div className="space-y-5 p-5 sm:p-6">
            {me?.wallet && !replacing ? (
              <>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    Linked EVM address
                  </p>
                  <p className="radius-surface-inner border border-border/70 bg-muted px-4 py-3 font-mono text-xs text-foreground">
                    {me.wallet.address}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void copyAddress(me.wallet!.address)}
                    >
                      {copied ? (
                        <Check className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Copy className="h-4 w-4" aria-hidden="true" />
                      )}
                      {copied ? "Copied" : "Copy address"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        window.open(
                          addressExplorerUrl(me.wallet!.address),
                          "_blank",
                          "noreferrer",
                        )
                      }
                    >
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      Explorer
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    Inbox public key fingerprint
                  </p>
                  <p className="radius-surface-inner border border-border/70 bg-muted px-4 py-3 font-mono text-xs text-muted-foreground">
                    {me.wallet.inboxPubkey.slice(0, 18)}…
                  </p>
                </div>
                <div className="radius-surface-inner space-y-2 border border-warning-border bg-warning-surface px-4 py-3 text-sm">
                  <p className="font-medium text-warning">Before you replace</p>
                  <p className="text-muted-foreground">
                    Replacing your wallet requires a new signed link. Old notes
                    encrypted to the previous inbox key stay recoverable only
                    with that key.
                  </p>
                </div>
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => setReplacing(true)}
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  Replace wallet
                </Button>
              </>
            ) : (
              <>
                {replacing && me?.wallet && (
                  <p className="text-sm text-muted-foreground">
                    Link a new wallet to replace{" "}
                    <span className="font-mono text-xs">
                      {me.wallet.address.slice(0, 10)}…
                    </span>
                  </p>
                )}
                <LinkWalletPanel
                  token={token}
                  onLinked={async () => {
                    setReplacing(false);
                    await refresh(token);
                  }}
                />
                {replacing && (
                  <Button
                    className="w-full"
                    variant="secondary"
                    onClick={() => setReplacing(false)}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                    Cancel
                  </Button>
                )}
              </>
            )}
          </div>
        </section>
      )}

      {error && (
        <p className="mt-4 text-center text-sm text-destructive">{error}</p>
      )}
    </PageShell>
  );
}
