import nacl from "tweetnacl";
import { bytesToHex, hexToBytes } from "./encryption.ts";
import { sha256Bytes, sha256Hex } from "./hash.ts";

const SECP256K1_N = BigInt(
  "0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141",
);
const SECP256K1_HALF_N = SECP256K1_N / 2n;

/** Require a low-s 65-byte ECDSA signature and normalize v to {27,28}. */
export function canonicalizeSignature(sigHex: string): Uint8Array {
  const hex = sigHex.startsWith("0x") ? sigHex.slice(2) : sigHex;
  if (hex.length !== 130 || !/^[0-9a-fA-F]+$/.test(hex)) {
    throw new Error("signature must be 65 bytes");
  }
  const r = hex.slice(0, 64);
  const s = BigInt(`0x${hex.slice(64, 128)}`);
  let v = parseInt(hex.slice(128, 130), 16);
  if (s > SECP256K1_HALF_N) {
    throw new Error("signature must use low-s form");
  }
  if (v === 0 || v === 1) v += 27;
  if (v !== 27 && v !== 28) {
    throw new Error("invalid recovery id");
  }
  const sHex = s.toString(16).padStart(64, "0");
  return hexToBytes(`0x${r}${sHex}${v.toString(16).padStart(2, "0")}`);
}

export function signatureHash(sigHex: string): string {
  const canonical = canonicalizeSignature(sigHex);
  return sha256Hex(canonical);
}

export function inboxKeySeed(sigHex: string): Uint8Array {
  const canonical = canonicalizeSignature(sigHex);
  return sha256Bytes(canonical);
}

export function buildWalletChallenge(params: {
  domain: string;
  version: string;
  userId: string;
  address: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
  apiOrigin: string;
}): string {
  return [
    params.domain,
    `version:${params.version}`,
    `user:${params.userId}`,
    `address:${params.address}`,
    `chain:${params.chainId}`,
    `nonce:${params.nonce}`,
    `issued:${params.issuedAt}`,
    `expires:${params.expiresAt}`,
    `origin:${params.apiOrigin}`,
  ].join("\n");
}

export function buildInboxKeyMessage(userId: string, chainId: number): string {
  return `wisp-inbox-key-v1\nuser:${userId}\nchain:${chainId}`;
}

export function deriveInboxPubkeyFromSignature(sigHex: string): `0x${string}` {
  const seed = inboxKeySeed(sigHex);
  const pair = nacl.box.keyPair.fromSecretKey(seed);
  return bytesToHex(pair.publicKey);
}

export function parseWalletChallenge(challenge: string): Record<string, string> {
  const lines = challenge.split("\n");
  const out: Record<string, string> = { domain: lines[0] ?? "" };
  for (const line of lines.slice(1)) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    out[line.slice(0, idx)] = line.slice(idx + 1);
  }
  return out;
}
