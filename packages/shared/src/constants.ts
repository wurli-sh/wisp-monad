/** BN254 scalar field (Circom/snarkjs bn128). */
export const SNARK_SCALAR_FIELD =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

/** Domain tags for Poseidon preimages (binding addendum to impl-plan §4.2). */
export const NOTE_V1 = 1n;
export const NULLIFIER_V1 = 2n;
export const RECIPIENT_V1 = 3n;

/** USDC base units (6 decimals). */
export const DENOMINATIONS = [
  1_000_000n,
  10_000_000n,
  50_000_000n,
  100_000_000n,
] as const;

export type Denomination = (typeof DENOMINATIONS)[number];

export const TREE_DEPTH = 20;
export const ROOT_HISTORY_SIZE = 4096;

export const MONAD_TESTNET_CHAIN_ID = 10143;
export const CIRCLE_MONAD_TESTNET_USDC =
  "0x534b2f3A21130d7a60830c2Df862319e593943A3" as const;

export const PUBLIC_SIGNAL_ORDER = [
  "root",
  "nullifier",
  "recipientAddress",
  "denomination",
  "chainId",
  "poolAddress",
  "recipientBinding",
] as const;

export const CIRCUIT_PUBLIC_SIGNAL_LABEL =
  "wisp-claim-v1:root,nullifier,recipientAddress,denomination,chainId,poolAddress,recipientBinding";
