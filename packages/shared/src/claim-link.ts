import type { ClaimPayloadV1 } from "./field.ts";
import { claimPayloadV1Schema } from "./schemas.ts";

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

/** Encode ClaimPayloadV1 as URL-safe base64 JSON (for `/claim#p=`). */
export function encodeClaimPayload(payload: ClaimPayloadV1): string {
  const parsed = claimPayloadV1Schema.parse(payload);
  const json = JSON.stringify(parsed);
  return bytesToBase64Url(new TextEncoder().encode(json));
}

/** Decode and validate `#p=` / claim-link payload. */
export function decodeClaimPayload(encoded: string): ClaimPayloadV1 {
  if (!encoded || encoded.length > 200_000) {
    throw new Error("invalid claim payload encoding");
  }
  let json: string;
  try {
    json = new TextDecoder().decode(base64UrlToBytes(encoded));
  } catch {
    throw new Error("invalid claim payload encoding");
  }
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error("invalid claim payload JSON");
  }
  return claimPayloadV1Schema.parse(raw) as ClaimPayloadV1;
}

/** Build a same-origin claim URL with fragment secret. */
export function buildClaimUrl(webOrigin: string, payload: ClaimPayloadV1): string {
  const encoded = encodeClaimPayload(payload);
  return `${webOrigin.replace(/\/$/, "")}/claim#p=${encoded}`;
}
