"use client";

import { useEffect, useState, type ReactNode } from "react";
import { decryptEnvelope, hexToBytes } from "@wisp/crypto/encryption";
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
import { toast } from "sonner";
import { ArrowUpRight, ExternalLink, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { PageShell } from "@/components/PageShell";
import { MotionPillButton } from "@/components/WispVisaCard";
import { useInboxUnlock } from "@/components/InboxUnlockProvider";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { poolAbi } from "@/lib/abis";
import { friendlyError } from "@/lib/toast";
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
import { cn } from "@/lib/cn";
import { UsdcIcon } from "@/components/UsdcIcon";

function AnimatedTableRow({
  children,
  index,
}: {
  children: ReactNode;
  index: number;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.tr
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reduce
          ? { duration: 0 }
          : {
              duration: 0.2,
              delay: Math.min(index, 6) * 0.03,
              ease: "easeOut",
            }
      }
      className="transition-colors duration-100 ease-out hover:bg-selection/60"
    >
      {children}
    </motion.tr>
  );
}

function InboxTable({
  children,
  mobileChildren,
  columns,
  emptyMessage,
  empty = false,
  loading = false,
  colSpan,
}: {
  columns: string[];
  children: ReactNode;
  mobileChildren?: ReactNode;
  emptyMessage?: string;
  empty?: boolean;
  loading?: boolean;
  colSpan: number;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-card">
      <div className="sm:hidden">
        {loading ? (
          <div className="space-y-3 p-3" aria-label="Loading inbox rows">
            {Array.from({ length: 2 }).map((_, index) => (
              <div
                key={index}
                className="rounded-xl border border-border/70 bg-card p-4 shadow-soft"
              >
                <div className="flex items-center justify-between gap-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="radius-control h-6 w-20" />
                </div>
                <Skeleton className="mt-5 h-4 w-2/3" />
                <Skeleton className="radius-control mt-4 h-10 w-full" />
              </div>
            ))}
          </div>
        ) : empty ? (
          <p className="px-5 py-12 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </p>
        ) : (
          <div className="space-y-3 p-3">{mobileChildren}</div>
        )}
      </div>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[34rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/80">
              {columns.map((col, index) => {
                const isActionColumn =
                  col === "Action" ||
                  (col === "" && index === columns.length - 1);
                return (
                  <th
                    key={col}
                    className={cn(
                      "px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground",
                      isActionColumn && "text-right",
                    )}
                  >
                    {col}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody
            className="divide-y divide-border/50"
            aria-busy={loading || undefined}
          >
            {loading ? (
              Array.from({ length: 3 }).map((_, rowIndex) => (
                <tr key={rowIndex} aria-hidden="true">
                  {columns.map((_, columnIndex) => (
                    <td key={columnIndex} className="px-4 py-4">
                      <Skeleton
                        className={cn(
                          "h-4",
                          columnIndex === columns.length - 1
                            ? "ml-auto w-16"
                            : columnIndex % 2 === 0
                              ? "w-24"
                              : "w-32",
                        )}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : empty ? (
              <tr>
                <td
                  colSpan={colSpan}
                  className="px-4 py-14 text-center text-sm text-muted-foreground"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              children
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InboxMobileCard({ children }: { children: ReactNode }) {
  return (
    <article className="rounded-xl border border-border/70 bg-card p-4 shadow-soft">
      {children}
    </article>
  );
}

function InboxDetail({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 min-w-0 text-sm text-foreground">{children}</div>
    </div>
  );
}

function UsdcAmount({
  amount,
  className,
}: {
  amount: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-medium tabular-nums text-foreground",
        className,
      )}
    >
      {amount}
      <UsdcIcon />
      <span className="text-sm text-muted-foreground">USDC</span>
    </span>
  );
}

function StatusPill({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "brand" | "success" | "muted" | "warning";
}) {
  const tones = {
    brand: "border-brand-muted bg-brand-soft text-brand-ink",
    success: "border-success/20 bg-success/10 text-success",
    muted: "border-border bg-muted text-muted-foreground",
    warning: "border-warning-border bg-warning-surface text-warning",
  };
  const dots = {
    brand: "bg-brand",
    success: "bg-success",
    muted: "bg-muted-foreground",
    warning: "bg-warning",
  };
  return (
    <span
      className={cn(
        "radius-control inline-flex whitespace-nowrap items-center gap-1.5 border px-2.5 py-1 text-xs font-medium capitalize",
        tones[tone],
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-1.5 rounded-full", dots[tone])}
      />
      {children}
    </span>
  );
}

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

function parseSentActivity(
  row: ActivityRow,
  plaintext: Uint8Array,
): SentActivity {
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
  const [notesLoading, setNotesLoading] = useState(true);
  const [invitesLoading, setInvitesLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);
  const [tableDelayDone, setTableDelayDone] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const { privKey, setPrivKey } = useInboxUnlock();
  const [linkedWallet, setLinkedWallet] = useState<string | null>(null);
  const { address } = useAccount();
  const { connectAsync } = useConnect();
  const { switchChainAsync } = useSwitchChain();
  const { signMessageAsync } = useSignMessage();
  const publicClient = usePublicClient();
  const reduce = useReducedMotion();

  useEffect(() => {
    setTableDelayDone(false);
    const delay = reduce ? 0 : 400;
    const id = window.setTimeout(() => setTableDelayDone(true), delay);
    return () => window.clearTimeout(id);
  }, [privKey, reduce, tab]);

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
      const msg = "Link a wallet on Account first.";
      setStatus(msg);
      toast.error(msg);
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
      toast.success("Inbox unlocked");
    } catch (e) {
      const msg = friendlyError(e, "Inbox unlock failed.");
      setStatus(msg);
      toast.error(msg);
    }
  }

  useEffect(() => {
    if (!token || !privKey || !publicClient) return;
    setNotesLoading(true);
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
        setStatus(
          skipped ? `${skipped} note(s) skipped (wrong key or corrupt)` : null,
        );
      } catch (e) {
        setStatus(e instanceof Error ? e.message : "Failed to load inbox");
      } finally {
        setNotesLoading(false);
      }
    })();
  }, [token, privKey, publicClient]);

  useEffect(() => {
    if (!token || tab !== "sent") return;
    setInvitesLoading(true);
    apiFetch<{ invites: ApiInviteRow[] }>("/v1/invites", { token })
      .then((response) => setInvites(normalizeInvitesResponse(response)))
      .catch(() => setInvites([]))
      .finally(() => setInvitesLoading(false));
  }, [token, tab]);

  useEffect(() => {
    if (!token || !privKey || tab !== "sent") return;
    setActivityLoading(true);
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
        setStatus(
          e instanceof Error ? e.message : "Failed to load sent history",
        );
      })
      .finally(() => setActivityLoading(false));
  }, [token, privKey, tab]);

  if (!token) {
    return (
      <PageShell
        title="Inbox"
        subtitle="Sign in to see what’s waiting."
        maxWidth="lg"
      >
        <InboxTable
          columns={["Amount", "Note", "Status", "Action"]}
          colSpan={4}
          empty
          emptyMessage="Sign in from the navbar, then unlock with your linked wallet."
        >
          {null}
        </InboxTable>
      </PageShell>
    );
  }

  const claimable = notes.filter((n) => !n.spent);
  const history = notes.filter((n) => n.spent);

  return (
    <PageShell
      title="Inbox"
      subtitle="Notes for you — claimable, claimed, and sent."
      maxWidth="lg"
    >
      <div className="mb-6 flex flex-col items-center gap-4">
        {!privKey ? (
          <MotionPillButton
            onClick={() => void unlock()}
            className="max-w-xs border-brand-dark/25 bg-brand font-semibold text-brand-foreground shadow-action hover:bg-brand-dark"
          >
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            Unlock inbox
          </MotionPillButton>
        ) : (
          <p className="radius-control border border-success/25 bg-success/15 px-4 py-2 text-sm font-medium text-success">
            Inbox unlocked for this session
          </p>
        )}
        <SegmentedTabs
          items={[
            { value: "history", label: "History" },
            { value: "claimable", label: "Claimable" },
            { value: "sent", label: "Sent" },
          ]}
          value={tab}
          onValueChange={setTab}
          ariaLabel="Inbox sections"
          layoutId="inbox-sections"
        />
      </div>

      {!privKey && (
        <InboxTable
          columns={["Amount", "Note", "Status", "Action"]}
          colSpan={4}
          empty
          emptyMessage="Unlock once. Your notes stay private to you."
        >
          {null}
        </InboxTable>
      )}

      {privKey && tab === "claimable" && (
        <InboxTable
          columns={["Amount", "Note", "Status", "Action"]}
          colSpan={4}
          loading={!tableDelayDone || notesLoading}
          empty={claimable.length === 0}
          emptyMessage="Nothing new."
          mobileChildren={claimable.map((n) => (
            <InboxMobileCard key={n.id}>
              <div className="flex items-start justify-between gap-3">
                <UsdcAmount amount={n.amount} className="text-base" />
                <StatusPill tone="success">Claimable</StatusPill>
              </div>
              <div className="mt-4">
                <InboxDetail label="Note">
                  <span className="block truncate font-mono text-xs text-muted-foreground">
                    {n.commitment.slice(0, 14)}…
                  </span>
                </InboxDetail>
              </div>
              <Button
                className="mt-4 w-full"
                onClick={() => {
                  window.location.href = buildClaimUrl(
                    window.location.origin,
                    n.payload,
                  );
                }}
              >
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                Claim
              </Button>
            </InboxMobileCard>
          ))}
        >
          {claimable.map((n, index) => (
            <AnimatedTableRow key={n.id} index={index}>
              <td className="whitespace-nowrap px-4 py-4">
                <UsdcAmount amount={n.amount} />
              </td>
              <td className="px-4 py-4 font-mono text-xs text-muted-foreground">
                {n.commitment.slice(0, 14)}…
              </td>
              <td className="px-4 py-4">
                <StatusPill tone="success">Claimable</StatusPill>
              </td>
              <td className="px-4 py-4 text-right">
                <Button
                  size="sm"
                  onClick={() => {
                    window.location.href = buildClaimUrl(
                      window.location.origin,
                      n.payload,
                    );
                  }}
                >
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  Claim
                </Button>
              </td>
            </AnimatedTableRow>
          ))}
        </InboxTable>
      )}

      {privKey && tab === "history" && (
        <InboxTable
          columns={["Amount", "Note", "Status"]}
          colSpan={3}
          loading={!tableDelayDone || notesLoading}
          empty={history.length === 0}
          emptyMessage="Nothing claimed yet."
          mobileChildren={history.map((n) => (
            <InboxMobileCard key={n.id}>
              <div className="flex items-start justify-between gap-3">
                <UsdcAmount amount={n.amount} className="text-base" />
                <StatusPill>Spent</StatusPill>
              </div>
              <div className="mt-4">
                <InboxDetail label="Note">
                  <span className="block truncate font-mono text-xs text-muted-foreground">
                    {n.commitment.slice(0, 14)}…
                  </span>
                </InboxDetail>
              </div>
            </InboxMobileCard>
          ))}
        >
          {history.map((n, index) => (
            <AnimatedTableRow key={n.id} index={index}>
              <td className="whitespace-nowrap px-4 py-4">
                <UsdcAmount amount={n.amount} />
              </td>
              <td className="px-4 py-4 font-mono text-xs text-muted-foreground">
                {n.commitment.slice(0, 14)}…
              </td>
              <td className="px-4 py-4">
                <StatusPill>Spent</StatusPill>
              </td>
            </AnimatedTableRow>
          ))}
        </InboxTable>
      )}

      {privKey && tab === "sent" && (
        <div className="space-y-6">
          <InboxTable
            columns={["Amount", "Recipient", "Delivery", "When", ""]}
            colSpan={5}
            loading={
              !tableDelayDone || activityLoading || invitesLoading
            }
            empty={sentActivity.length === 0}
            emptyMessage="Nothing sent yet."
            mobileChildren={sentActivity.map((activity) => {
              const deliveryTone =
                activity.delivery === "registered"
                  ? "success"
                  : activity.delivery === "recovery_required"
                    ? "warning"
                    : "brand";
              return (
                <InboxMobileCard key={activity.id}>
                  <div className="flex items-start justify-between gap-3">
                    <UsdcAmount
                      amount={activity.amount}
                      className="text-base"
                    />
                    <StatusPill tone={deliveryTone}>
                      {activity.delivery.replaceAll("_", " ")}
                    </StatusPill>
                  </div>
                  <div className="mt-4 grid gap-3">
                    <InboxDetail label="Recipient">
                      <span className="block truncate">
                        {activity.recipient}
                      </span>
                    </InboxDetail>
                    <InboxDetail label="Sent">
                      <span className="text-muted-foreground">
                        {new Date(activity.createdAt).toLocaleString()}
                      </span>
                    </InboxDetail>
                  </div>
                  <a
                    className="mt-4 inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-brand transition-colors duration-100 ease-out hover:text-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    href={transactionExplorerUrl(activity.depositTxHash)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    View on explorer
                  </a>
                </InboxMobileCard>
              );
            })}
          >
            {sentActivity.map((activity, index) => (
              <AnimatedTableRow key={activity.id} index={index}>
                <td className="whitespace-nowrap px-4 py-4">
                  <UsdcAmount amount={activity.amount} />
                </td>
                <td className="max-w-[10rem] truncate px-4 py-4 text-sm text-foreground">
                  {activity.recipient}
                </td>
                <td className="px-4 py-4">
                  <StatusPill
                    tone={
                      activity.delivery === "registered"
                        ? "success"
                        : activity.delivery === "recovery_required"
                          ? "warning"
                          : "brand"
                    }
                  >
                    {activity.delivery.replaceAll("_", " ")}
                  </StatusPill>
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-xs text-muted-foreground">
                  {new Date(activity.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-4 text-right">
                  <a
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-brand transition-colors duration-100 ease-out hover:bg-brand-soft hover:text-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    href={transactionExplorerUrl(activity.depositTxHash)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    Explorer
                  </a>
                </td>
              </AnimatedTableRow>
            ))}
          </InboxTable>

          {invites.length > 0 && (
            <div className="space-y-3">
              <p className="text-center text-sm font-semibold text-foreground">
                Email delivery status
              </p>
              <InboxTable
                columns={["Recipient", "Kind", "Status", "Created"]}
                colSpan={4}
                loading={!tableDelayDone || invitesLoading}
                mobileChildren={invites.map((inv) => (
                  <InboxMobileCard key={inv.id}>
                    <div className="flex items-start justify-between gap-3">
                      <InboxDetail label="Recipient">
                        <span className="block truncate">
                          {inv.normalizedHandle}
                        </span>
                      </InboxDetail>
                      <StatusPill
                        tone={
                          inv.claimedAt
                            ? "success"
                            : inv.deliveredAt
                              ? "muted"
                              : "warning"
                        }
                      >
                        {inv.claimedAt
                          ? "Claimed"
                          : inv.deliveredAt
                            ? "Delivered"
                            : "Pending"}
                      </StatusPill>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <InboxDetail label="Delivery">
                        <span className="text-muted-foreground">
                          {inv.deliveryKind}
                        </span>
                      </InboxDetail>
                      <InboxDetail label="Created">
                        <span className="text-xs text-muted-foreground">
                          {new Date(inv.createdAt).toLocaleString()}
                        </span>
                      </InboxDetail>
                    </div>
                  </InboxMobileCard>
                ))}
              >
                {invites.map((inv, index) => (
                  <AnimatedTableRow key={inv.id} index={index}>
                    <td className="px-4 py-4 text-sm text-foreground">
                      {inv.normalizedHandle}
                    </td>
                    <td className="px-4 py-4 text-sm text-muted-foreground">
                      {inv.deliveryKind}
                    </td>
                    <td className="px-4 py-4">
                      <StatusPill
                        tone={
                          inv.claimedAt
                            ? "success"
                            : inv.deliveredAt
                              ? "muted"
                              : "warning"
                        }
                      >
                        {inv.claimedAt
                          ? "Claimed"
                          : inv.deliveredAt
                            ? "Delivered"
                            : "Pending"}
                      </StatusPill>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-xs text-muted-foreground">
                      {new Date(inv.createdAt).toLocaleString()}
                    </td>
                  </AnimatedTableRow>
                ))}
              </InboxTable>
            </div>
          )}
        </div>
      )}

      {status && (
        <p className="mt-4 text-center text-sm text-muted-foreground">
          {status}
        </p>
      )}
      {!address && privKey && (
        <p className="mt-2 text-center text-sm text-warning">
          Connect wallet to claim.
        </p>
      )}
    </PageShell>
  );
}
