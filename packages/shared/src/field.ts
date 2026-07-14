import {
  CIRCLE_MONAD_TESTNET_USDC,
  MONAD_TESTNET_CHAIN_ID,
  SNARK_SCALAR_FIELD,
} from "./constants.ts";

export type Hex32 = `0x${string}`;
export type Address = `0x${string}`;

export type ClaimPayloadV1 = {
  v: 1;
  chainId: typeof MONAD_TESTNET_CHAIN_ID;
  pool: Address;
  token: typeof CIRCLE_MONAD_TESTNET_USDC;
  denomination: string;
  secret: Hex32;
  recipientKeyDigest: Hex32;
  commitment: Hex32;
  depositTxHash?: Hex32;
};

export function assertCanonicalField(value: bigint, label = "field"): void {
  if (value < 0n || value >= SNARK_SCALAR_FIELD) {
    throw new Error(`${label} out of canonical field range`);
  }
}

export function hexToField(hex: string, label = "field"): bigint {
  const normalized = hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex;
  if (normalized.length !== 64 || !/^[0-9a-fA-F]+$/.test(normalized)) {
    throw new Error(`${label} must be 32-byte hex`);
  }
  const value = BigInt(`0x${normalized}`);
  assertCanonicalField(value, label);
  return value;
}

export function fieldToHex(value: bigint): Hex32 {
  assertCanonicalField(value);
  return `0x${value.toString(16).padStart(64, "0")}` as Hex32;
}
