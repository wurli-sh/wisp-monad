import { createHash } from "node:crypto";
import { SNARK_SCALAR_FIELD } from "@wisp/shared";
import nacl from "tweetnacl";
import { noteCommitment } from "./poseidon.ts";

const DOMAIN_RECIPIENT_KEY = "wisp-recipient-key-v1";

/** SHA-256 domain + length-prefixed payload, reduced mod r (impl-plan §4.1). */
export function hashToField(domain: string, payload: Uint8Array): bigint {
  const domainBytes = new TextEncoder().encode(domain);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(payload.length, 0);
  const digest = createHash("sha256")
    .update(domainBytes)
    .update(len)
    .update(payload)
    .digest();
  let value = 0n;
  for (const byte of digest) {
    value = (value << 8n) + BigInt(byte);
  }
  return value % SNARK_SCALAR_FIELD;
}

export function recipientKeyDigest(sharedSecret: Uint8Array): bigint {
  if (sharedSecret.length !== 32) {
    throw new Error("shared secret must be 32 bytes");
  }
  const allZero = sharedSecret.every((b) => b === 0);
  if (allZero) throw new Error("zero shared secret");
  return hashToField(DOMAIN_RECIPIENT_KEY, sharedSecret);
}

export function x25519SharedSecret(
  privateKey: Uint8Array,
  publicKey: Uint8Array,
): Uint8Array {
  if (privateKey.length !== 32 || publicKey.length !== 32) {
    throw new Error("invalid X25519 key length");
  }
  const shared = nacl.scalarMult(privateKey, publicKey);
  if (shared.every((byte) => byte === 0)) throw new Error("invalid X25519 public key");
  return shared;
}

export function encryptEnvelope(
  recipientPubkey: Uint8Array,
  senderSecret: Uint8Array,
  plaintext: Uint8Array,
): {
  ephemeralPubkey: Uint8Array;
  nonce: Uint8Array;
  ciphertext: Uint8Array;
} {
  recipientKeyDigest(x25519SharedSecret(senderSecret, recipientPubkey));
  const ephemeral = nacl.box.keyPair.fromSecretKey(senderSecret);
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const ciphertext = nacl.box(
    plaintext,
    nonce,
    recipientPubkey,
    ephemeral.secretKey,
  );
  if (!ciphertext) throw new Error("encryption failed");
  return {
    ephemeralPubkey: ephemeral.publicKey,
    nonce,
    ciphertext,
  };
}

/** Builds the commitment and ciphertext from one ephemeral X25519 secret. */
export async function createRegisteredNoteEnvelope(params: {
  recipientPubkey: Uint8Array;
  secret: bigint;
  denomination: bigint;
  chainId: bigint;
  poolAddress: bigint;
  encodePayload: (material: {
    recipientKeyDigest: bigint;
    commitment: bigint;
  }) => Uint8Array;
}): Promise<{
  recipientKeyDigest: bigint;
  commitment: bigint;
  ephemeralPubkey: Uint8Array;
  nonce: Uint8Array;
  ciphertext: Uint8Array;
}> {
  if (params.recipientPubkey.length !== nacl.box.publicKeyLength) {
    throw new Error("invalid X25519 key length");
  }
  const ephemeralSecret = nacl.randomBytes(nacl.box.secretKeyLength);
  const sharedSecret = x25519SharedSecret(ephemeralSecret, params.recipientPubkey);
  const digest = recipientKeyDigest(sharedSecret);
  const commitment = await noteCommitment({
    secret: params.secret,
    recipientKeyDigest: digest,
    denomination: params.denomination,
    chainId: params.chainId,
    poolAddress: params.poolAddress,
  });
  const encrypted = encryptEnvelope(
    params.recipientPubkey,
    ephemeralSecret,
    params.encodePayload({ recipientKeyDigest: digest, commitment }),
  );
  return { recipientKeyDigest: digest, commitment, ...encrypted };
}

export function decryptEnvelope(
  recipientSecret: Uint8Array,
  ephemeralPubkey: Uint8Array,
  nonce: Uint8Array,
  ciphertext: Uint8Array,
): Uint8Array {
  if (
    recipientSecret.length !== nacl.box.secretKeyLength ||
    ephemeralPubkey.length !== nacl.box.publicKeyLength ||
    nonce.length !== nacl.box.nonceLength ||
    ciphertext.length < nacl.box.overheadLength
  ) {
    throw new Error("invalid envelope");
  }
  const opened = nacl.box.open(
    ciphertext,
    nonce,
    ephemeralPubkey,
    recipientSecret,
  );
  if (!opened) throw new Error("invalid envelope");
  return opened;
}

export function envelopeHash(parts: {
  recipientPubkey: string;
  ephemeralPubkey: string;
  nonce: string;
  ciphertext: string;
}): string {
  return createHash("sha256")
    .update(
      `${parts.recipientPubkey.toLowerCase()}:${parts.ephemeralPubkey.toLowerCase()}:${parts.nonce.toLowerCase()}:${parts.ciphertext.toLowerCase()}`,
    )
    .digest("hex");
}

export function hexToBytes(hex: string): Uint8Array {
  const stripped = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (stripped.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(stripped)) {
    throw new Error("invalid hex");
  }
  const out = new Uint8Array(stripped.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(stripped.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function bytesToHex(bytes: Uint8Array): `0x${string}` {
  return `0x${Buffer.from(bytes).toString("hex")}` as `0x${string}`;
}
