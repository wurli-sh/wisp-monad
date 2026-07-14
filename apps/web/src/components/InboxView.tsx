"use client";

import { useEffect, useState } from "react";
import {
  decryptEnvelope,
  hexToBytes,
} from "@wisp/crypto/encryption";
import { noteCommitment, noteNullifier } from "@wisp/crypto/poseidon";
import { buildInboxKeyMessage, inboxKeySeed } from "@wisp/crypto/signature";
import {
  buildClaimUrl,
  fieldToHex,
  hexToField,
  type ClaimPayloadV1,
} from "@wisp/shared";
import {
  useAccount,
  useConnect,
  usePublicClient,
  useSignMessage,
  useSwitchChain,
} from "wagmi";
import { getAccount } from "@wagmi/core";
import { injected } from "wagmi/connectors";
import { monadTestnet } from "viem/chains";
import { formatUnits } from "viem";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { poolAbi } from "@/lib/abis";
import { TextShimmer } from "@/components/ui/TextShimmer";
import { buttonHover, buttonTap } from "@/lib/motion";
import nacl from "tweetnacl";
import {
  normalizeInvitesResponse,
  normalizeActivityResponse,
  normalizeMeResponse,
  normalizeNotesResponse,
  type ActivityRow,
  type ApiActivityRow,
  type ApiInviteRow,
  type ApiMeResponse,
  type ApiNoteRow,
  type InviteRow,
} from "@/lib/api-contracts";
import { parseTrustedClaimPayload } from "@/lib/claim";
import { manifest, transactionExplorerUrl, wagmiConfig } from "@/lib/wagmi";
import { decodeSentActivity } from "@/lib/activity";

type DecryptedNote = {
  id: string;
  amount: string;
  pool: string;
  commitment: string;
  spent: boolean;
  payload: ClaimPayloadV1;
};

type SentActivity = {
  id: string;
  recipient: string;
  amount: string;
  depositTxHash: `0x${string}`;
  delivery: string;
  createdAt: string;
};

function parseSentActivity(row: ActivityRow, plaintext: Uint8Array): SentActivity {
  const raw = decodeSentActivity(plaintext, manifest);
  return {
    id: row.id,
    recipient: raw.displayRecipient,
    amount: formatUnits(BigInt(raw.denomination), 6),
    depositTxHash: raw.depositTxHash as `0x${string}`,
    delivery: raw.delivery,
    createdAt: row.createdAt,
  };
}

export function InboxView() {
  const [tab, setTab] = useState<"claimable" | "history" | "sent">("claimable");
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [notes, setNotes] = useState<DecryptedNote[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [sentActivity, setSentActivity] = useState<SentActivity[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [privKey, setPrivKey] = useState<Uint8Array | null>(null);
  const [linkedWallet, setLinkedWallet] = useState<string | null>(null);
  const reduce = useReducedMotion();

  const { address } = useAccount();
  const { connectAsync } = useConnect();
  const { switchChainAsync } = useSwitchChain();
  const { signMessageAsync } = useSignMessage();
  const publicClient = usePublicClient();

  useEffect(() => {
    createClient()
      .auth.getSession()
      .then(async ({ data }) => {
        const t = data.session?.access_token ?? null;
        setToken(t);
        setUserId(data.session?.user.id ?? null);
        if (t) {
          const raw = await apiFetch<ApiMeResponse>("/v1/me", { token: t });
          setLinkedWallet(normalizeMeResponse(raw).wallet?.address ?? null);
        }
      })
      .catch((e: unknown) => {
        setStatus(e instanceof Error ? e.message : "Failed to load account");
      });
  }, []);

  async function unlock() {
    if (!userId || !linkedWallet) {
      setStatus("Link a wallet on Register before unlocking the inbox.");
      return;
    }
    try {
      setStatus("Connect the linked wallet…");
      if (!getAccount(wagmiConfig).address) {
        await connectAsync({ connector: injected() });
      }
      if (getAccount(wagmiConfig).chainId !== monadTestnet.id) {
        await switchChainAsync({ chainId: monadTestnet.id });
      }
      const connected = getAccount(wagmiConfig);
      if (
        !connected.address ||
        connected.address.toLowerCase() !== linkedWallet.toLowerCase()
      ) {
        throw new Error("Connect the wallet linked to this Wisp account");
      }
      setStatus("Sign to unlock inbox…");
      const msg = buildInboxKeyMessage(userId, monadTestnet.id);
      const sig = await signMessageAsync({ message: msg });
      const seed = inboxKeySeed(sig);
      const pair = nacl.box.keyPair.fromSecretKey(seed);
      setPrivKey(pair.secretKey);
      setStatus(null);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Inbox unlock failed");
    }
  }

  useEffect(() => {
    if (!token || !privKey || !publicClient) return;
    void (async () => {
      try {
        const response = await apiFetch<{ notes: ApiNoteRow[] }>("/v1/notes", {
          token,
        });
        const rows = normalizeNotesResponse(response);
        const out: DecryptedNote[] = [];
        let skipped = 0;
        for (const row of rows) {
          try {
            const opened = decryptEnvelope(
              privKey,
              hexToBytes(row.ephemeralPubkey),
              hexToBytes(row.nonce),
              hexToBytes(row.ciphertext),
            );
            const json = JSON.parse(new TextDecoder().decode(opened));
            const payload = parseTrustedClaimPayload(json, manifest);
            const commitment = await noteCommitment({
              secret: hexToField(payload.secret),
              recipientKeyDigest: hexToField(payload.recipientKeyDigest),
              denomination: BigInt(payload.denomination),
              chainId: BigInt(payload.chainId),
              poolAddress: BigInt(payload.pool),
            });
            if (
              fieldToHex(commitment).toLowerCase() !==
              payload.commitment.toLowerCase()
            ) {
              throw new Error("Note commitment mismatch");
            }
            const nullifier = await noteNullifier({
              secret: hexToField(payload.secret),
              recipientKeyDigest: hexToField(payload.recipientKeyDigest),
              chainId: BigInt(payload.chainId),
              poolAddress: BigInt(payload.pool),
            });
            const spent = await publicClient.readContract({
              address: payload.pool as `0x${string}`,
              abi: poolAbi,
              functionName: "isSpent",
              args: [fieldToHex(nullifier)],
            });
            out.push({
              id: row.id,
              amount: formatUnits(BigInt(payload.denomination), 6),
              pool: payload.pool,
              commitment: payload.commitment,
              spent: Boolean(spent) || !!row.claimedAt,
              payload,
            });
          } catch {
            skipped += 1;
          }
        }
        setNotes(out);
        setStatus(skipped ? `${skipped} note(s) skipped (wrong key or corrupt)` : null);
      } catch (e) {
        setStatus(e instanceof Error ? e.message : "Failed to load inbox");
      }
    })();
  }, [token, privKey, publicClient]);

  useEffect(() => {
    if (!token || tab !== "sent") return;
    apiFetch<{ invites: ApiInviteRow[] }>("/v1/invites", { token })
      .then((response) => setInvites(normalizeInvitesResponse(response)))
      .catch(() => setInvites([]));
  }, [token, tab]);

  useEffect(() => {
    if (!token || !privKey || tab !== "sent") return;
    void apiFetch<{ activity: ApiActivityRow[] }>("/v1/activity", { token })
      .then((response) => {
        const decoded: SentActivity[] = [];
        for (const row of normalizeActivityResponse(response)) {
          try {
            decoded.push(
              parseSentActivity(
                row,
                decryptEnvelope(
                  privKey,
                  hexToBytes(row.ephemeralPubkey),
                  hexToBytes(row.nonce),
                  hexToBytes(row.ciphertext),
                ),
              ),
            );
          } catch {
            // Activity is owner-only ciphertext; corrupt or legacy rows stay hidden.
          }
        }
        setSentActivity(decoded);
      })
      .catch((e: unknown) => {
        setStatus(e instanceof Error ? e.message : "Failed to load sent history");
      });
  }, [token, privKey, tab]);

  if (!token) {
    return <p className="text-muted-foreground">Sign in to open your inbox.</p>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">Inbox</h1>
      {!privKey ? (
        <Button onClick={() => void unlock()}>Unlock inbox</Button>
      ) : (
        <p className="text-sm text-success">Inbox unlocked for this session</p>
      )}
      <div className="flex gap-2">
        {(["claimable", "history", "sent"] as const).map((t) => (
          <motion.button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            whileHover={reduce ? undefined : buttonHover}
            whileTap={reduce ? undefined : buttonTap}
            className={`rounded-full px-4 py-2 text-sm font-semibold capitalize ${
              tab === t ? "bg-brand text-white shadow-blue-pill" : "bg-muted"
            }`}
          >
            {t}
          </motion.button>
        ))}
      </div>

      {tab !== "sent" && (
        <ul className="space-y-3">
          {notes
            .filter((n) => (tab === "claimable" ? !n.spent : n.spent))
            .map((n) => (
              <li
                key={n.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-bold">{n.amount} USDC</p>
                  <p className="text-xs text-muted-foreground">
                    {n.spent ? "Spent" : "Claimable"} · {n.commitment.slice(0, 12)}…
                  </p>
                </div>
                {!n.spent && (
                  <Button
                    size="sm"
                    onClick={() => {
                      window.location.href = buildClaimUrl(
                        window.location.origin,
                        n.payload,
                      );
                    }}
                  >
                    Claim
                  </Button>
                )}
              </li>
            ))}
        </ul>
      )}

      {tab === "sent" && (
        <div className="space-y-6">
          <ul className="space-y-3">
            {sentActivity.map((activity) => (
              <li
                key={activity.id}
                className="rounded-2xl border border-border bg-card px-4 py-3 text-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-semibold">
                      {activity.amount} USDC to {activity.recipient}
                    </p>
                    <p className="break-words text-muted-foreground">
                      {activity.delivery.replaceAll("_", " ")} · {new Date(activity.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <a
                    className="shrink-0 text-brand underline"
                    href={transactionExplorerUrl(activity.depositTxHash)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Explorer
                  </a>
                </div>
              </li>
            ))}
          </ul>
          {invites.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Email delivery status</p>
              <ul className="space-y-3">
                {invites.map((inv) => (
                  <li
                    key={inv.id}
                    className="rounded-2xl border border-border bg-card px-4 py-3 text-sm"
                  >
                    <p className="font-semibold">{inv.normalizedHandle}</p>
                    <p className="text-muted-foreground">
                      {inv.deliveryKind} · created {new Date(inv.createdAt).toLocaleString()}
                      {inv.deliveredAt ? " · delivered" : ""}
                      {inv.claimedAt ? " · claimed" : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {status && <p className="text-sm text-muted-foreground">{status}</p>}
      {!address && privKey && (
        <p className="text-sm text-warning">Connect wallet to claim notes.</p>
      )}
      {privKey && notes.length === 0 && tab !== "sent" && (
        <TextShimmer active={false}>No notes yet</TextShimmer>
      )}
    </div>
  );
}
