import {
  CIRCLE_MONAD_TESTNET_USDC,
  DENOMINATIONS,
  MONAD_TESTNET_CHAIN_ID,
} from "./constants.ts";
import { hexToField, type ClaimPayloadV1 } from "./field.ts";
import { claimPayloadV1Schema } from "./schemas.ts";

const COMPACT_CLAIM_VERSION = 2;
const COMPACT_CLAIM_LENGTH = 1 + 1 + 20 + 32 + 32 + 32;

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  const b64 =
    typeof btoa === "function"
      ? btoa(binary)
      : Buffer.from(bytes).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(encoded: string): Uint8Array {
  const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (padded.length % 4)) % 4;
  const b64 = padded + "=".repeat(padLen);
  if (typeof atob === "function") {
    const binary = atob(b64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(b64, "base64"));
}

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.slice(2);
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): `0x${string}` {
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

/** Encode the compact v2 claim payload for a `#p=` URL fragment. */
export function encodeClaimPayload(payload: ClaimPayloadV1): string {
  const parsed = claimPayloadV1Schema.parse(payload);
  const denominationIndex = DENOMINATIONS.findIndex(
    (denomination) => denomination.toString() === parsed.denomination,
  );
  if (denominationIndex < 0) throw new Error("unsupported claim denomination");

  const bytes = new Uint8Array(COMPACT_CLAIM_LENGTH);
  bytes[0] = COMPACT_CLAIM_VERSION;
  bytes[1] = denominationIndex;
  bytes.set(hexToBytes(parsed.pool), 2);
  bytes.set(hexToBytes(parsed.secret), 22);
  bytes.set(hexToBytes(parsed.recipientKeyDigest), 54);
  bytes.set(hexToBytes(parsed.commitment), 86);
  return bytesToBase64Url(bytes);
}

/** Decode and validate the compact v2 `#p=` claim-link payload. */
export function decodeClaimPayload(encoded: string): ClaimPayloadV1 {
  if (!encoded || !/^[A-Za-z0-9_-]+$/.test(encoded)) {
    throw new Error("invalid claim payload encoding");
  }
  let bytes: Uint8Array;
  try {
    bytes = base64UrlToBytes(encoded);
  } catch {
    throw new Error("invalid claim payload encoding");
  }
  if (bytes.length !== COMPACT_CLAIM_LENGTH || bytes[0] !== COMPACT_CLAIM_VERSION) {
    throw new Error("unsupported claim payload version");
  }
  const denominationIndex = bytes[1];
  if (denominationIndex === undefined) throw new Error("invalid claim denomination");
  const denomination = DENOMINATIONS[denominationIndex];
  if (denomination === undefined) throw new Error("invalid claim denomination");

  const secret = bytesToHex(bytes.slice(22, 54));
  const recipientKeyDigest = bytesToHex(bytes.slice(54, 86));
  const commitment = bytesToHex(bytes.slice(86, 118));
  hexToField(secret, "secret");
  hexToField(recipientKeyDigest, "recipient key digest");
  hexToField(commitment, "commitment");

  return claimPayloadV1Schema.parse({
    v: 1,
    chainId: MONAD_TESTNET_CHAIN_ID,
    pool: bytesToHex(bytes.slice(2, 22)),
    token: CIRCLE_MONAD_TESTNET_USDC,
    denomination: denomination.toString(),
    secret,
    recipientKeyDigest,
    commitment,
  }) as ClaimPayloadV1;
}

/** Build a same-origin claim URL with fragment secret. */
export function buildClaimUrl(webOrigin: string, payload: ClaimPayloadV1): string {
  const encoded = encodeClaimPayload(payload);
  return `${webOrigin.replace(/\/$/, "")}/c#p=${encoded}`;
}
