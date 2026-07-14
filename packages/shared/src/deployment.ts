import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  CIRCLE_MONAD_TESTNET_USDC,
  MONAD_TESTNET_CHAIN_ID,
} from "./constants.ts";
import type { PoolDenomKey } from "./schemas.ts";

const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const bytes32 = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const sha256 = z.string().regex(/^[0-9a-f]{64}$/);

const deployedContractSchema = z.object({
  address: address,
  explorerUrl: z.string().url(),
  transactionHash: bytes32,
  blockNumber: z.number().int().positive(),
}).strict();

export const deploymentSchema = z.object({
  version: z.literal(1),
  chainId: z.literal(MONAD_TESTNET_CHAIN_ID),
  network: z.literal("Monad Testnet"),
  deploymentBlock: z.number().int().positive(),
  admin: address,
  token: z.object({
    address: z.literal(CIRCLE_MONAD_TESTNET_USDC),
    decimals: z.literal(6),
    symbol: z.literal("USDC"),
    issuer: z.literal("Circle"),
  }),
  circuitId: bytes32,
  verifier: deployedContractSchema,
  poseidon: deployedContractSchema,
  pools: z.object({
    "1000000": deployedContractSchema,
    "10000000": deployedContractSchema,
    "50000000": deployedContractSchema,
    "100000000": deployedContractSchema,
  }).strict(),
  generatedAt: z.string().datetime(),
  circuitArtifacts: z.object({
    wasm: sha256,
    zkey: sha256,
    verificationKey: sha256,
    solidityVerifier: sha256,
    r1cs: sha256,
  }).strict(),
});

export type DeploymentManifest = z.infer<typeof deploymentSchema>;

export type PoolAddresses = Record<
  PoolDenomKey,
  `0x${string}`
>;

export function poolAddresses(manifest: DeploymentManifest): PoolAddresses {
  const p = manifest.pools;
  return {
    "1000000": p["1000000"]!.address as `0x${string}`,
    "10000000": p["10000000"]!.address as `0x${string}`,
    "50000000": p["50000000"]!.address as `0x${string}`,
    "100000000": p["100000000"]!.address as `0x${string}`,
  };
}

export function loadDeploymentManifest(
  rootDir?: string,
): DeploymentManifest {
  const base =
    rootDir ??
    join(dirname(fileURLToPath(import.meta.url)), "../../..");
  const path = join(base, "deployments", `${MONAD_TESTNET_CHAIN_ID}.json`);
  const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
  return deploymentSchema.parse(raw);
}

export function poolByDenom(
  manifest: DeploymentManifest,
  denomination: bigint,
): `0x${string}` | undefined {
  const key = String(denomination) as keyof typeof manifest.pools;
  return manifest.pools[key]?.address as `0x${string}` | undefined;
}

export function allPoolAddresses(manifest: DeploymentManifest): `0x${string}`[] {
  return Object.values(manifest.pools).map(
    (p) => p.address as `0x${string}`,
  );
}
