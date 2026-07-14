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
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api";
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
import type { MerklePathResponse } from "./claim-types";

export function ClaimClient() {
  const [payload, setPayload] = useState<ClaimPayloadV1 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [canCancel, setCanCancel] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const warned = useRef(false);
  const cancelRef = useRef<(() => void) | null>(null);

  const { connectAsync } = useConnect();
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  useEffect(() => {
    const hash = window.location.hash;
    if (new URL(window.location.href).searchParams.has("p")) {
      setError("Query-string claim links are rejected. Use /claim#p=… only.");
      return;
    }
    if (!hash.startsWith("#p=")) {
      setError("No claim payload in the URL fragment.");
      return;
    }
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
          setError("Commitment mismatch — payload is invalid");
          return;
        }
        setPayload(decoded);
        if (!warned.current) {
          warned.current = true;
          // Strip fragment after load into memory
          window.history.replaceState(null, "", "/claim");
        }
      } catch (e) {
        if (active) {
          setError(e instanceof Error ? e.message : "Invalid claim payload");
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

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
      const path = await apiFetch<MerklePathResponse>("/v1/merkle/path", {
        method: "POST",
        body: { pool: payload.pool, commitment: payload.commitment },
      });

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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Claim failed");
      setProgress(null);
      setCanCancel(false);
      cancelRef.current = null;
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-3xl font-bold">Claim</h1>
      <p className="text-sm text-muted-foreground">
        Bearer link authorization. The claim transaction sender pays MON gas and is
        visible on-chain. Refreshing loses the fragment — keep the original link.
      </p>
      {payload && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-2xl font-bold">
            {formatUnits(BigInt(payload.denomination), 6)} USDC
          </p>
          <p className="mt-2 text-xs text-muted-foreground break-all">
            Pool {payload.pool}
          </p>
        </div>
      )}
      <div className="flex gap-2">
        <Button disabled={!payload || !!txHash || !!progress} onClick={() => void claim()}>
          {progress ? <TextShimmer>{progress}</TextShimmer> : "Connect & claim"}
        </Button>
        {canCancel && (
          <Button variant="outline" onClick={() => cancelRef.current?.()}>
            Cancel
          </Button>
        )}
      </div>
      {txHash && (
        <a
          className="text-sm text-brand underline"
          href={transactionExplorerUrl(txHash)}
          target="_blank"
          rel="noreferrer"
        >
          View claim on explorer
        </a>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
