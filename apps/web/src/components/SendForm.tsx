"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  createRegisteredNoteEnvelope,
  encryptEnvelope,
  hexToBytes,
  bytesToHex,
} from "@wisp/crypto/encryption";
import { noteCommitment } from "@wisp/crypto/poseidon";
import {
  buildClaimUrl,
  fieldToHex,
  poolByDenom,
  type ClaimPayloadV1,
  type ResolveResult,
  CIRCLE_MONAD_TESTNET_USDC,
  MONAD_TESTNET_CHAIN_ID,
} from "@wisp/shared";
import {
  useConnect,
  usePublicClient,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { getAccount } from "@wagmi/core";
import { injected } from "wagmi/connectors";
import { monadTestnet } from "viem/chains";
import { formatUnits, parseEventLogs } from "viem";
import { motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { Check, Copy, ExternalLink, Send } from "lucide-react";
import { MotionPillButton, WispVisaCard } from "@/components/WispVisaCard";
import { UsdcIcon } from "@/components/UsdcIcon";
import { friendlyError } from "@/lib/toast";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { poolAbi, erc20Abi } from "@/lib/abis";
import {
  manifest,
  USDC_ADDRESS,
  USDC_DECIMALS,
  transactionExplorerUrl,
  wagmiConfig,
} from "@/lib/wagmi";
import { TextShimmer } from "@/components/ui/TextShimmer";
import { buttonTap } from "@/lib/motion";
import { normalizeMeResponse, type ApiMeResponse } from "@/lib/api-contracts";
import { encodeSentActivity, type SentDeliveryKind } from "@/lib/activity";

const DENOMS = [1_000_000n, 10_000_000n, 50_000_000n, 100_000_000n] as const;

type Stage =
  | "idle"
  | "resolving"
  | "wallet_required"
  | "wrong_chain"
  | "ready"
  | "approving"
  | "depositing"
  | "delivering"
  | "complete"
  | "delivery_recovery"
  | "error";

function randomSecret(): bigint {
  const bytes = new Uint8Array(31);
  crypto.getRandomValues(bytes);
  let v = 0n;
  for (const b of bytes) v = (v << 8n) + BigInt(b);
  return v;
}

export function SendForm() {
  const params = useSearchParams();
  const [to, setTo] = useState(params.get("to") ?? "");
  const [denom, setDenom] = useState<bigint>(1_000_000n);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [recoveryUrl, setRecoveryUrl] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [lockedRecipient, setLockedRecipient] = useState<string | null>(null);
  const [sentAmount, setSentAmount] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [senderInboxPubkey, setSenderInboxPubkey] = useState<string | null>(
    null,
  );
  const [emailConsent, setEmailConsent] = useState(false);
  const sendingRef = useRef(false);
  const reduce = useReducedMotion();

  const { connectAsync } = useConnect();
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const pool = useMemo(
    () => poolByDenom(manifest, denom) as `0x${string}` | undefined,
    [denom],
  );

  useEffect(() => {
    try {
      createClient()
        .auth.getSession()
        .then(async ({ data }) => {
          const accessToken = data.session?.access_token ?? null;
          setToken(accessToken);
          if (accessToken) {
            const raw = await apiFetch<ApiMeResponse>("/v1/me", {
              token: accessToken,
            });
            setSenderInboxPubkey(
              normalizeMeResponse(raw).wallet?.inboxPubkey ?? null,
            );
          }
        })
        .catch(() => {
          setToken(null);
          setSenderInboxPubkey(null);
        });
    } catch {
      setToken(null);
    }
  }, []);

  async function ensureWallet(): Promise<`0x${string}`> {
    if (!getAccount(wagmiConfig).address) {
      await connectAsync({ connector: injected() });
    }
    if (getAccount(wagmiConfig).chainId !== monadTestnet.id) {
      setStage("wrong_chain");
      await switchChainAsync({ chainId: monadTestnet.id });
    }
    const current = getAccount(wagmiConfig);
    if (!current.address) throw new Error("Wallet not connected");
    if (current.chainId !== monadTestnet.id) {
      throw new Error("Switch your wallet to Monad testnet");
    }
    return current.address;
  }

  async function recordSentActivity(params: {
    recipient: string;
    displayRecipient: string;
    denomination: bigint;
    pool: `0x${string}`;
    commitment: `0x${string}`;
    depositTxHash: `0x${string}`;
    delivery: SentDeliveryKind;
  }): Promise<void> {
    if (!token || !senderInboxPubkey) return;
    const ephemeralSecret = crypto.getRandomValues(new Uint8Array(32));
    const encrypted = encryptEnvelope(
      hexToBytes(senderInboxPubkey),
      ephemeralSecret,
      encodeSentActivity({
        v: 1,
        kind: "sent",
        recipient: params.recipient,
        displayRecipient: params.displayRecipient,
        denomination: params.denomination.toString(),
        pool: params.pool,
        commitment: params.commitment,
        depositTxHash: params.depositTxHash,
        delivery: params.delivery,
        createdAt: new Date().toISOString(),
      }),
    );
    await apiFetch("/v1/activity", {
      method: "POST",
      token,
      body: {
        recipientPubkey: senderInboxPubkey,
        ephemeralPubkey: bytesToHex(encrypted.ephemeralPubkey),
        nonce: bytesToHex(encrypted.nonce),
        ciphertext: bytesToHex(encrypted.ciphertext),
      },
    });
  }

  async function send() {
    if (!pool || !publicClient || sendingRef.current) return;
    sendingRef.current = true;
    setError(null);
    setRecoveryUrl(null);
    setTxHash(null);
    setSentAmount(null);
    setCopied(false);
    let createdRecovery = false;
    try {
      const recipient = to.trim();
      if (!recipient) throw new Error("Enter a recipient");
      setStage("resolving");
      const resolve = await apiFetch<ResolveResult>(
        `/v1/resolve?q=${encodeURIComponent(recipient)}`,
      );
      const displayRecipient =
        resolve.found && resolve.displayHandle
          ? resolve.displayHandle
          : recipient;
      setLockedRecipient(displayRecipient);
      const looksEmail = recipient.includes("@") && !recipient.startsWith("@");
      if (resolve.found) {
        const resolvedPool =
          resolve.pools[denom.toString() as keyof typeof resolve.pools];
        if (
          resolve.chainId !== MONAD_TESTNET_CHAIN_ID ||
          resolve.token.toLowerCase() !== USDC_ADDRESS.toLowerCase() ||
          resolvedPool?.toLowerCase() !== pool.toLowerCase()
        ) {
          throw new Error(
            "Resolved recipient deployment does not match this app",
          );
        }
        if (!token) {
          throw new Error("Sign in before sending to a registered inbox");
        }
      }
      if (!resolve.found && looksEmail) {
        if (!emailConsent) throw new Error("Email consent required");
        if (!token) throw new Error("Sign in before sending an email invite");
      }

      const sender = await ensureWallet();
      setStage("ready");

      const decimals = await publicClient.readContract({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "decimals",
      });
      if (Number(decimals) !== USDC_DECIMALS) {
        throw new Error("Unexpected USDC decimals");
      }
      const bal = await publicClient.readContract({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [sender],
      });
      if (bal < denom) {
        throw new Error(
          `Insufficient Circle USDC. Get testnet USDC from Circle’s faucet, then refresh.`,
        );
      }
      const mon = await publicClient.getBalance({ address: sender });
      if (mon === 0n) throw new Error("Need MON for gas on Monad testnet");

      const secret = randomSecret();
      let recipientKeyDigest: bigint;
      let commitment: bigint;
      let envelope: {
        recipientPubkey: string;
        ephemeralPubkey: string;
        nonce: string;
        ciphertext: string;
      } | null = null;

      if (resolve.found) {
        const pk = hexToBytes(resolve.inboxPubkey);
        const built = await createRegisteredNoteEnvelope({
          recipientPubkey: pk,
          secret,
          denomination: denom,
          chainId: BigInt(MONAD_TESTNET_CHAIN_ID),
          poolAddress: BigInt(pool),
          encodePayload: ({ recipientKeyDigest: d, commitment: c }) =>
            new TextEncoder().encode(
              JSON.stringify({
                v: 1,
                chainId: MONAD_TESTNET_CHAIN_ID,
                pool,
                token: CIRCLE_MONAD_TESTNET_USDC,
                denomination: denom.toString(),
                secret: fieldToHex(secret),
                recipientKeyDigest: fieldToHex(d),
                commitment: fieldToHex(c),
              }),
            ),
        });
        recipientKeyDigest = built.recipientKeyDigest;
        commitment = built.commitment;
        envelope = {
          recipientPubkey: resolve.inboxPubkey,
          ephemeralPubkey: bytesToHex(built.ephemeralPubkey),
          nonce: bytesToHex(built.nonce),
          ciphertext: bytesToHex(built.ciphertext),
        };
      } else {
        recipientKeyDigest = 0n;
        commitment = await noteCommitment({
          secret,
          recipientKeyDigest,
          denomination: denom,
          chainId: BigInt(MONAD_TESTNET_CHAIN_ID),
          poolAddress: BigInt(pool),
        });
      }

      const commitmentHex = fieldToHex(commitment);
      const allowance = await publicClient.readContract({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "allowance",
        args: [sender, pool],
      });
      if (allowance < denom) {
        setStage("approving");
        const approval = await publicClient.simulateContract({
          address: USDC_ADDRESS,
          abi: erc20Abi,
          functionName: "approve",
          args: [pool, denom],
          account: sender,
        });
        const approveHash = await writeContractAsync(approval.request);
        const approveReceipt = await publicClient.waitForTransactionReceipt({
          hash: approveHash,
        });
        if (approveReceipt.status !== "success")
          throw new Error("Approval failed");
      }

      setStage("depositing");
      const deposit = await publicClient.simulateContract({
        address: pool,
        abi: poolAbi,
        functionName: "deposit",
        args: [commitmentHex],
        account: sender,
      });
      const depositHash = await writeContractAsync(deposit.request);
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: depositHash,
      });
      if (receipt.status !== "success") throw new Error("Deposit failed");
      setTxHash(depositHash);
      setSentAmount(formatUnits(denom, 6));

      const payload: ClaimPayloadV1 = {
        v: 1,
        chainId: MONAD_TESTNET_CHAIN_ID,
        pool,
        token: CIRCLE_MONAD_TESTNET_USDC,
        denomination: denom.toString(),
        secret: fieldToHex(secret),
        recipientKeyDigest: fieldToHex(recipientKeyDigest),
        commitment: commitmentHex,
        depositTxHash: depositHash,
      };
      const claimUrl = buildClaimUrl(window.location.origin, payload);

      setStage("delivering");
      let delivery: SentDeliveryKind = resolve.found
        ? "registered"
        : looksEmail
          ? "email"
          : "claim_link";
      let deliveryFailed = false;
      try {
        if (resolve.found && envelope && token) {
          await apiFetch("/v1/notes", {
            method: "POST",
            token,
            body: envelope,
          });
        } else if (!resolve.found) {
          if (looksEmail) {
            await publicClient.waitForTransactionReceipt({
              hash: depositHash,
              confirmations: 6,
            });
            const logs = parseEventLogs({
              abi: poolAbi,
              logs: receipt.logs,
              eventName: "Deposit",
            });
            const logIndex = logs[0]?.logIndex;
            if (logIndex === undefined) {
              throw new Error("Deposit event missing from transaction receipt");
            }
            await apiFetch("/v1/invites", {
              method: "POST",
              token,
              body: {
                normalizedHandle: recipient.toLowerCase(),
                deliveryKind: "email",
                recipientEmail: recipient.toLowerCase(),
                claimPayload: payload,
                logIndex,
              },
            });
          } else {
            createdRecovery = true;
            setRecoveryUrl(claimUrl);
            setStage("complete");
          }
        }
        if (delivery !== "claim_link") setStage("complete");
      } catch (deliveryErr) {
        delivery = "recovery_required";
        deliveryFailed = true;
        createdRecovery = true;
        setRecoveryUrl(claimUrl);
        setStage("delivery_recovery");
        const deliveryMsg = friendlyError(
          deliveryErr,
          "Delivery failed — copy your recovery link.",
        );
        setError(deliveryMsg);
        toast.error(deliveryMsg);
      }

      try {
        await recordSentActivity({
          recipient,
          displayRecipient:
            resolve.found && resolve.displayHandle
              ? resolve.displayHandle
              : recipient,
          denomination: denom,
          pool,
          commitment: commitmentHex,
          depositTxHash: depositHash,
          delivery,
        });
      } catch {
        if (!deliveryFailed) {
          toast.error("Sent, but history wasn’t saved.");
        }
      }
    } catch (e) {
      setStage("error");
      const msg = friendlyError(e, "Send failed.");
      setError(msg);
      toast.error(msg);
      if (!createdRecovery) {
        setLockedRecipient(null);
        setSentAmount(null);
      }
    } finally {
      sendingRef.current = false;
    }
  }

  const cardRecipient = lockedRecipient ?? "…";
  const cardAmount = sentAmount ?? formatUnits(denom, 6);

  async function copyClaimLink(url: string) {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Claim link copied");
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div>
      <div className="radius-surface overflow-hidden border border-border/80 bg-card p-2 shadow-card">
        <div className="radius-surface-inner border border-brand/15 bg-brand-mist px-6 py-6 text-center sm:px-8 sm:py-7">
          <p className="text-xs font-medium text-muted-foreground">Amount</p>
          <div className="mt-3 flex flex-nowrap justify-center gap-1.5">
            {DENOMS.map((d) => (
              <motion.button
                data-motion-button
                key={d.toString()}
                type="button"
                onClick={() => setDenom(d)}
                whileTap={reduce ? undefined : buttonTap}
                className={`radius-control shrink-0 cursor-pointer border px-3 py-2 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:px-4 sm:py-2.5 sm:text-sm ${
                  denom === d
                    ? "border-selection-hover bg-selection text-selection-foreground shadow-soft"
                    : "border-border/60 bg-card/85 text-foreground/60 backdrop-blur-sm hover:bg-muted hover:text-foreground"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  {formatUnits(d, 6)}
                  <UsdcIcon className="size-4" />
                  USDC
                </span>
              </motion.button>
            ))}
          </div>
        </div>

        <div className="space-y-4 px-3 pb-3 pt-5 sm:px-4 sm:pb-4">
          <div className="space-y-1">
            <label
              htmlFor="send-recipient"
              className="block text-sm font-semibold text-foreground"
            >
              Recipient
            </label>
            <input
              id="send-recipient"
              type="text"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setError(null);
                if (stage === "error") setStage("idle");
              }}
              placeholder="@handle or email"
              autoComplete="off"
              spellCheck={false}
              className="radius-control w-full border border-border/70 bg-muted px-5 py-3.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/70 transition-[border-color,box-shadow] duration-100 ease-out focus:border-brand focus:ring-2 focus:ring-ring/30"
            />
            <p className="px-1 text-xs leading-5 text-muted-foreground">
              Registered handle? Goes to their inbox. Otherwise you get a
              private claim link.
            </p>
          </div>

          {to.trim() && (
            <div className="radius-surface-inner space-y-2 border border-warning-border bg-warning-surface px-4 py-3 text-sm text-muted-foreground">
              <p>If they’re new to Wisp, keep the claim link safe.</p>
              {to.includes("@") && !to.trim().startsWith("@") && (
                <label className="flex min-h-10 cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={emailConsent}
                    onChange={(e) => setEmailConsent(e.target.checked)}
                  />
                  <span>Email it (the provider can see the link).</span>
                </label>
              )}
            </div>
          )}

          {error && stage === "error" && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <MotionPillButton
            disabled={
              !pool ||
              !to.trim() ||
              stage === "resolving" ||
              stage === "approving" ||
              stage === "depositing" ||
              stage === "delivering"
            }
            onClick={() => void send()}
            className="w-full border-brand-dark/30 bg-brand text-base font-semibold text-brand-foreground shadow-action hover:bg-brand-dark sm:min-h-12 sm:text-lg"
          >
            {stage === "resolving" ||
            stage === "approving" ||
            stage === "depositing" ||
            stage === "delivering" ? (
              <TextShimmer>Working…</TextShimmer>
            ) : (
              <>
                <Send className="h-4 w-4" aria-hidden="true" />
                Send
              </>
            )}
          </MotionPillButton>
        </div>
      </div>

      {stage === "complete" && !recoveryUrl && (
        <div className="mt-8">
          <WispVisaCard
            hideHeader
            amount={cardAmount}
            recipient={cardRecipient}
            status="Sent"
            compact
            note={txHash ? `${txHash.slice(0, 10)}…` : "Private note posted"}
            footer={
              txHash ? (
                <MotionPillButton
                  onClick={() =>
                    window.open(
                      transactionExplorerUrl(txHash),
                      "_blank",
                      "noreferrer",
                    )
                  }
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  View on explorer
                </MotionPillButton>
              ) : undefined
            }
          />
        </div>
      )}

      {recoveryUrl && (
        <div className="mt-8 space-y-4">
          <WispVisaCard
            hideHeader
            amount={cardAmount}
            recipient={cardRecipient}
            status={stage === "delivery_recovery" ? "Recover" : "Claim Link"}
            compact
            note="Anyone with the link can claim — treat it like cash"
            footer={
              <div className="flex flex-wrap gap-2">
                <MotionPillButton
                  onClick={() => void copyClaimLink(recoveryUrl)}
                >
                  {copied ? (
                    <Check className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Copy className="h-4 w-4" aria-hidden="true" />
                  )}
                  {copied ? "Copied!" : "Copy claim link"}
                </MotionPillButton>
                {txHash && (
                  <MotionPillButton
                    onClick={() =>
                      window.open(
                        transactionExplorerUrl(txHash),
                        "_blank",
                        "noreferrer",
                      )
                    }
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    Explorer
                  </MotionPillButton>
                )}
              </div>
            }
          />
          {stage === "complete" && cardRecipient.startsWith("@") && (
            <div className="radius-surface border border-border/80 bg-card p-5 text-sm shadow-card">
              <p className="font-semibold text-foreground">
                Copy message for X
              </p>
              <textarea
                readOnly
                className="radius-surface-inner mt-2 h-28 w-full border border-border/60 bg-muted p-3 font-sans text-xs"
                value={`I sent you ${cardAmount} USDC privately on Wisp. Claim here: ${recoveryUrl}`}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
