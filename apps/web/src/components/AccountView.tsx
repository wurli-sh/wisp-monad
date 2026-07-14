"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { buttonHover, buttonTap } from "@/lib/motion";
import {
  normalizeMeResponse,
  type ApiMeResponse,
  type MeResponse,
} from "@/lib/api-contracts";

export function AccountView() {
  const [tab, setTab] = useState<"handles" | "wallet">("handles");
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const reduce = useReducedMotion();

  async function refresh(t: string) {
    const data = await apiFetch<ApiMeResponse>("/v1/me", { token: t });
    setMe(normalizeMeResponse(data));
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
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/v1/handles/${id}`, { method: "DELETE", token });
      await refresh(token);
    } catch (e) {
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
        provider: "twitter",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/account`,
        },
      });
      if (linkError) throw linkError;
    } catch (e) {
      setError(e instanceof Error ? e.message : "X account link failed");
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) {
    return <p className="text-muted-foreground">Loading account…</p>;
  }

  if (!token) {
    return <p className="text-muted-foreground">Sign in to manage your account.</p>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">Account</h1>
      <div className="flex gap-2">
        {(["handles", "wallet"] as const).map((t) => (
          <motion.button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            whileHover={reduce ? undefined : buttonHover}
            whileTap={reduce ? undefined : buttonTap}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              tab === t ? "bg-brand text-white shadow-blue-pill" : "bg-muted"
            }`}
          >
            {t === "handles" ? "Handles" : "Wallet"}
          </motion.button>
        ))}
      </div>

      {tab === "handles" && (
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">
            Linked identities. X handles are verified via OAuth — you cannot type a
            free-form @handle.
          </p>
          <ul className="space-y-3">
            {me?.handles.map((h) => (
              <li
                key={h.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="break-all font-semibold">{h.display}</p>
                  <p className="text-xs uppercase text-muted-foreground">{h.provider}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => unlink(h.id)}
                >
                  Unlink
                </Button>
              </li>
            ))}
          </ul>
          <Button variant="secondary" disabled={busy} onClick={linkX}>
            Link X account
          </Button>
        </div>
      )}

      {tab === "wallet" && (
        <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
          {me?.wallet ? (
            <>
              <p className="text-sm text-muted-foreground">Linked EVM address</p>
              <p className="break-all text-sm font-semibold">{me.wallet.address}</p>
              <p className="text-sm text-muted-foreground">Inbox public key fingerprint</p>
              <p className="break-all text-xs">{me.wallet.inboxPubkey.slice(0, 18)}…</p>
              <p className="text-xs text-warning">
                Replacing your wallet requires a new signed link. Old notes encrypted to
                the previous inbox key stay recoverable only with that key.
              </p>
            </>
          ) : (
            <p className="text-muted-foreground">No wallet linked yet. Visit Register.</p>
          )}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
