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
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { poolAbi, erc20Abi } from "@/lib/abis";
import {
  CIRCUIT_ID,
  manifest,
  USDC_ADDRESS,
  USDC_DECIMALS,
  transactionExplorerUrl,
  wagmiConfig,
} from "@/lib/wagmi";
import { TextShimmer } from "@/components/ui/TextShimmer";
import { buttonHover, buttonTap } from "@/lib/motion";
import { normalizeMeResponse, type ApiMeResponse } from "@/lib/api-contracts";
import {
  encodeSentActivity,
  type SentDeliveryKind,
} from "@/lib/activity";

const DENOMS = [1_000_000n, 10_000_000n, 50_000_000n, 100_000_000n] as const;

type Stage =
  | "idle"
  | "resolving"
  | "found"
  | "unregistered"
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
  const [resolve, setResolve] = useState<ResolveResult | null>(null);
  const [resolvedTo, setResolvedTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recoveryUrl, setRecoveryUrl] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [senderInboxPubkey, setSenderInboxPubkey] = useState<string | null>(null);
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

  useEffect(() => {
    const trimmed = to.trim();
    setResolve(null);
    setResolvedTo(null);
    if (!trimmed) {
      setStage("idle");
      return;
    }

    const controller = new AbortController();
    let active = true;
    setStage("resolving");
    setError(null);
    const timer = setTimeout(() => {
      const q = encodeURIComponent(trimmed);
      void apiFetch<ResolveResult>(`/v1/resolve?q=${q}`, {
        signal: controller.signal,
      })
        .then((result) => {
          if (!active) return;
          setResolve(result);
          setResolvedTo(trimmed);
          setStage(result.found ? "found" : "unregistered");
        })
        .catch((e: unknown) => {
          if (!active) return;
          if (e instanceof DOMException && e.name === "AbortError") return;
          setStage("error");
          setError(e instanceof Error ? e.message : "Resolve failed");
        });
    }, 400);

    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [to]);

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
    try {
      const recipient = to.trim();
      if (!recipient || resolvedTo !== recipient || !resolve) {
        throw new Error("Wait for recipient resolution before sending");
      }
      const looksEmail = recipient.includes("@") && !recipient.startsWith("@");
      if (resolve.found) {
        const resolvedPool = resolve.pools[denom.toString() as keyof typeof resolve.pools];
        if (
          resolve.chainId !== MONAD_TESTNET_CHAIN_ID ||
          resolve.token.toLowerCase() !== USDC_ADDRESS.toLowerCase() ||
          resolvedPool?.toLowerCase() !== pool.toLowerCase()
        ) {
          throw new Error("Resolved recipient deployment does not match this app");
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
      let envelope:
        | {
            recipientPubkey: string;
            ephemeralPubkey: string;
            nonce: string;
            ciphertext: string;
          }
        | null = null;

      if (resolve?.found) {
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
        if (approveReceipt.status !== "success") throw new Error("Approval failed");
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
      let delivery: SentDeliveryKind =
        resolve.found ? "registered" : looksEmail ? "email" : "claim_link";
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
            setRecoveryUrl(claimUrl);
            setStage("complete");
          }
        }
        if (delivery !== "claim_link") setStage("complete");
      } catch (deliveryErr) {
        delivery = "recovery_required";
        deliveryFailed = true;
        setRecoveryUrl(claimUrl);
        setStage("delivery_recovery");
        setError(
          deliveryErr instanceof Error
            ? deliveryErr.message
            : "Delivery failed — copy your recovery claim link",
        );
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
          setError("Payment completed, but encrypted sent history could not be saved.");
        }
      }
    } catch (e) {
      setStage("error");
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      sendingRef.current = false;
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-3xl font-bold">Send USDC privately</h1>
      <p className="text-sm text-muted-foreground">
        Circle USDC on Monad testnet. Exact approve only. Circuit {CIRCUIT_ID.slice(0, 10)}…
      </p>
      <input
        value={to}
        onChange={(e) => setTo(e.target.value)}
        placeholder="@handle or email"
        className="w-full rounded-full border-2 border-border bg-card px-5 py-3"
      />
      <div className="flex flex-wrap gap-2">
        {DENOMS.map((d) => (
          <motion.button
            key={d.toString()}
            type="button"
            onClick={() => setDenom(d)}
            whileHover={reduce ? undefined : buttonHover}
            whileTap={reduce ? undefined : buttonTap}
            animate={denom === d && !reduce ? { scale: 1.04 } : { scale: 1 }}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              denom === d ? "bg-brand text-white shadow-blue-pill" : "border border-border bg-card"
            }`}
          >
            {formatUnits(d, 6)} USDC
          </motion.button>
        ))}
      </div>

      {stage === "resolving" && <TextShimmer>Resolving recipient…</TextShimmer>}
      {stage === "found" && resolve?.found && (
        <p className="text-sm text-success">
          Registered: {resolve.displayHandle}. Encrypted delivery to their inbox key.
        </p>
      )}
      {stage === "unregistered" && (
        <div className="space-y-2 rounded-2xl border border-warning/40 bg-card p-4 text-sm">
          <p className="font-semibold text-warning">Recipient is not registered</p>
          <p className="text-muted-foreground">
            You will get a bearer claim link. Anyone with the link can claim — it is not
            identity-locked.
          </p>
          {to.includes("@") && !to.trim().startsWith("@") && (
            <label className="flex items-start gap-2 text-muted-foreground">
              <input
                type="checkbox"
                checked={emailConsent}
                onChange={(e) => setEmailConsent(e.target.checked)}
              />
              <span>
                Email the claim link via Resend. The email provider can see the link.
              </span>
            </label>
          )}
        </div>
      )}

      <Button
        disabled={
          !pool ||
          !to.trim() ||
          resolvedTo !== to.trim() ||
          !resolve ||
          stage === "resolving" ||
          stage === "approving" ||
          stage === "depositing" ||
          stage === "delivering"
        }
        onClick={() => void send()}
      >
        {stage === "approving" || stage === "depositing" || stage === "delivering" ? (
          <TextShimmer>Working…</TextShimmer>
        ) : (
          "Send"
        )}
      </Button>

      {txHash && (
        <p className="text-sm">
          Deposit:{" "}
          <a
            className="text-brand underline"
            href={transactionExplorerUrl(txHash)}
            target="_blank"
            rel="noreferrer"
          >
            view on explorer
          </a>
        </p>
      )}
      {(stage === "delivery_recovery" || recoveryUrl) && recoveryUrl && (
        <div className="rounded-2xl border border-destructive/40 bg-card p-4 text-sm">
          <p className="font-semibold">Copy your recovery claim link</p>
          <textarea
            readOnly
            className="mt-2 h-24 w-full rounded-xl border border-border bg-background p-2 text-xs"
            value={recoveryUrl}
          />
          <Button
            className="mt-2"
            variant="secondary"
            onClick={() => void navigator.clipboard.writeText(recoveryUrl)}
          >
            Copy link
          </Button>
        </div>
      )}
      {stage === "complete" && !recoveryUrl && (
        <p className="text-sm text-success">Sent. Delivery complete.</p>
      )}
      {stage === "complete" && recoveryUrl && to.trim().startsWith("@") && (
        <div className="rounded-2xl border border-border bg-card p-4 text-sm">
          <p className="font-semibold">Copy message for X</p>
          <textarea
            readOnly
            className="mt-2 h-28 w-full rounded-xl border border-border p-2 text-xs"
            value={`I sent you ${formatUnits(denom, 6)} USDC privately on Wisp (Monad). Claim here: ${recoveryUrl}`}
          />
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
