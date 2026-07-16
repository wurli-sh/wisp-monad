"use client";

import { useEffect, useRef, useState } from "react";
import {
  noteCommitment,
  noteNullifier,
  recipientBindingHash,
} from "@wisp/crypto/poseidon";
import {
  decodeClaimPayload,
  fieldToHex,
  hexToField,
  type ClaimPayloadV1,
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
import { formatUnits } from "viem";
import { toast } from "sonner";
import { Wallet, X } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { NoteCardSkeleton } from "@/components/ui/Skeleton";
import { MotionPillButton, WispVisaCard } from "@/components/WispVisaCard";
import { apiFetchWithIndexerRetry } from "@/lib/api";
import { parseTrustedClaimPayload } from "@/lib/claim";
import { poolAbi } from "@/lib/abis";
import {
  CIRCUIT_ID,
  manifest,
  transactionExplorerUrl,
  wagmiConfig,
} from "@/lib/wagmi";
import { proveInWorker, verifyCircuitArtifacts } from "@/lib/prover/client";
import { TextShimmer } from "@/components/ui/TextShimmer";
import { friendlyError } from "@/lib/toast";
import type { MerklePathResponse } from "./claim-types";

type Props = {
  /** When true, omit PageShell (parent owns layout). */
  embedded?: boolean;
};

export function ClaimClient({ embedded = false }: Props) {
  const [payload, setPayload] = useState<ClaimPayloadV1 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [canCancel, setCanCancel] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [hasHash, setHasHash] = useState(false);
  const warned = useRef(false);
  const cancelRef = useRef<(() => void) | null>(null);

  const { connectAsync } = useConnect();
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  useEffect(() => {
    const hash = window.location.hash;
    if (new URL(window.location.href).searchParams.has("p")) {
      const msg = "Use claim links with #p=… only.";
      setError(msg);
      toast.error(msg);
      return;
    }
    if (!hash.startsWith("#p=")) {
      if (embedded) {
        // Empty claim tab — waiting for a link paste / navigation with hash.
        return;
      }
      const msg = "No claim payload in the URL.";
      setError(msg);
      toast.error(msg);
      return;
    }
    setHasHash(true);
    const encoded = hash.slice(3);
    let active = true;
    void (async () => {
      try {
        const decoded = parseTrustedClaimPayload(
          decodeClaimPayload(encoded),
          manifest,
        );
        const secret = hexToField(decoded.secret);
        const digest = hexToField(decoded.recipientKeyDigest);
        const commitment = await noteCommitment({
          secret,
          recipientKeyDigest: digest,
          denomination: BigInt(decoded.denomination),
          chainId: BigInt(decoded.chainId),
          poolAddress: BigInt(decoded.pool),
        });
        if (!active) return;
        if (
          fieldToHex(commitment).toLowerCase() !== decoded.commitment.toLowerCase()
        ) {
          const msg = "Invalid claim payload.";
          setError(msg);
          toast.error(msg);
          return;
        }
        setPayload(decoded);
        if (!warned.current) {
          warned.current = true;
          const qs = new URLSearchParams(window.location.search);
          qs.set("tab", "claim");
          window.history.replaceState(
            null,
            "",
            `${window.location.pathname}?${qs.toString()}`,
          );
        }
      } catch (e) {
        if (active) {
          const msg = friendlyError(e, "Invalid claim link.");
          setError(msg);
          toast.error(msg);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [embedded]);

  useEffect(
    () => () => {
      cancelRef.current?.();
    },
    [],
  );

  async function claim() {
    if (!payload || !publicClient) return;
    setError(null);
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
      const recipient = connected.address;
      setProgress("Verifying circuit artifacts…");
      await verifyCircuitArtifacts({
        wasm: manifest.circuitArtifacts.wasm,
        zkey: manifest.circuitArtifacts.zkey,
      });

      const onChainCircuit = await publicClient.readContract({
        address: payload.pool as `0x${string}`,
        abi: poolAbi,
        functionName: "circuitId",
      });
      if (onChainCircuit.toLowerCase() !== CIRCUIT_ID.toLowerCase()) {
        throw new Error("circuitId mismatch — terminal deployment error");
      }

      setProgress("Fetching Merkle path…");
      const path = await apiFetchWithIndexerRetry<MerklePathResponse>(
        "/v1/merkle/path",
        {
          method: "POST",
          body: { pool: payload.pool, commitment: payload.commitment },
          onRetry: () => setProgress("Waiting for indexer…"),
        },
      );

      const known = await publicClient.readContract({
        address: payload.pool as `0x${string}`,
        abi: poolAbi,
        functionName: "isKnownRoot",
        args: [path.root],
      });
      if (!known) throw new Error("Root unknown on-chain");

      const secret = hexToField(payload.secret);
      const digest = hexToField(payload.recipientKeyDigest);
      const nullifier = await noteNullifier({
        secret,
        recipientKeyDigest: digest,
        chainId: BigInt(payload.chainId),
        poolAddress: BigInt(payload.pool),
      });
      const binding = await recipientBindingHash({
        secret,
        recipientKeyDigest: digest,
        recipientAddress: BigInt(recipient),
      });

      const spent = await publicClient.readContract({
        address: payload.pool as `0x${string}`,
        abi: poolAbi,
        functionName: "isSpent",
        args: [fieldToHex(nullifier)],
      });
      if (spent) {
        throw new Error("This note is already spent.");
      }

      const input = {
        root: BigInt(path.root).toString(),
        nullifier: nullifier.toString(),
        recipientAddress: BigInt(recipient).toString(),
        denomination: payload.denomination,
        chainId: String(payload.chainId),
        poolAddress: BigInt(payload.pool).toString(),
        recipientBinding: binding.toString(),
        secret: secret.toString(),
        recipientKeyDigest: digest.toString(),
        pathElements: path.pathElements.map((e) => BigInt(e).toString()),
        pathIndices: path.pathIndices.map(String),
      };

      setProgress("Generating proof…");
      const job = proveInWorker(input, (s) => setProgress(`Proof: ${s}`));
      cancelRef.current = job.cancel;
      setCanCancel(true);
      const { proof, publicSignals } = await job.promise;
      setCanCancel(false);
      cancelRef.current = null;

      const expectedSignals = [
        BigInt(path.root),
        nullifier,
        BigInt(recipient),
        BigInt(payload.denomination),
        BigInt(payload.chainId),
        BigInt(payload.pool),
        binding,
      ];
      if (
        publicSignals.length !== expectedSignals.length ||
        publicSignals.some(
          (signal, index) => BigInt(signal) !== expectedSignals[index]!,
        )
      ) {
        throw new Error("Proof public signals do not match the claim");
      }

      const afterProof = getAccount(wagmiConfig);
      if (
        afterProof.address?.toLowerCase() !== recipient.toLowerCase() ||
        afterProof.chainId !== monadTestnet.id
      ) {
        throw new Error("Wallet or chain changed after proving — reprove required");
      }

      setProgress("Submitting claim…");
      const simulation = await publicClient.simulateContract({
        address: payload.pool as `0x${string}`,
        abi: poolAbi,
        functionName: "claim",
        args: [
          [BigInt(proof.a[0]), BigInt(proof.a[1])],
          [
            [BigInt(proof.b[0][0]), BigInt(proof.b[0][1])],
            [BigInt(proof.b[1][0]), BigInt(proof.b[1][1])],
          ],
          [BigInt(proof.c[0]), BigInt(proof.c[1])],
          path.root,
          fieldToHex(nullifier),
          recipient,
          fieldToHex(binding),
        ],
        account: recipient,
      });
      const hash = await writeContractAsync(simulation.request);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("Claim transaction failed");
      setTxHash(hash);
      setProgress("Claim finalized");
      toast.success("Claim finalized");
    } catch (e) {
      const msg = friendlyError(e, "Claim failed.");
      setError(msg);
      toast.error(msg);
      setProgress(null);
      setCanCancel(false);
      cancelRef.current = null;
    }
  }

  const loadingPayload = !payload && !error && (!embedded || hasHash);
  const emptyEmbedded = embedded && !payload && !error && !hasHash;

  const body = (
    <>
      {loadingPayload && <NoteCardSkeleton />}

      {emptyEmbedded && (
        <p className="text-center text-sm text-muted-foreground">
          Drop a claim link here — or open one from your inbox.
        </p>
      )}

      {payload && (
        <WispVisaCard
          hideHeader
          amount={formatUnits(BigInt(payload.denomination), 6)}
          note={`Note ${payload.commitment.slice(0, 12)}… · Circuit ${CIRCUIT_ID.slice(0, 10)}…`}
          status={txHash ? "Claimed" : "Claimable"}
          compact
          footer={
            <div className="flex flex-wrap gap-2">
              <MotionPillButton
                disabled={!!txHash || !!progress}
                onClick={() => void claim()}
              >
                {progress ? (
                  <TextShimmer>{progress}</TextShimmer>
                ) : (
                  <>
                    <Wallet className="h-4 w-4" aria-hidden="true" />
                    Connect & claim
                  </>
                )}
              </MotionPillButton>
              {canCancel && (
                <MotionPillButton
                  onClick={() => {
                    cancelRef.current?.();
                    toast.message("Proof cancelled");
                  }}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                  Cancel
                </MotionPillButton>
              )}
            </div>
          }
        />
      )}

      {error && (
        <p className="mt-4 text-center text-sm text-destructive">{error}</p>
      )}

      {txHash && (
        <p className="mt-4 text-center">
          <a
            className="text-sm font-semibold text-brand underline"
            href={transactionExplorerUrl(txHash)}
            target="_blank"
            rel="noreferrer"
          >
            View claim on explorer
          </a>
        </p>
      )}
    </>
  );

  if (embedded) return body;

  return <PageShell maxWidth="md">{body}</PageShell>;
}
