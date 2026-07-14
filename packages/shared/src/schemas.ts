import { z } from "zod";
import {
  CIRCLE_MONAD_TESTNET_USDC,
  DENOMINATIONS,
  MONAD_TESTNET_CHAIN_ID,
} from "./constants.ts";

export const hex32Schema = z.string().regex(/^0x[0-9a-f]{64}$/i);
export const hex24Schema = z.string().regex(/^0x[0-9a-f]{48}$/i);
export const hexDataSchema = z.string().regex(/^0x(?:[0-9a-f]{2})+$/i);
export const addressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/);

export const POOL_DENOM_KEYS = [
  "1000000",
  "10000000",
  "50000000",
  "100000000",
] as const;

export type PoolDenomKey = (typeof POOL_DENOM_KEYS)[number];

export const poolsRecordSchema = z.record(
  z.enum(POOL_DENOM_KEYS),
  addressSchema,
);

export const resolveResultSchema = z.discriminatedUnion("found", [
  z.object({ found: z.literal(false) }).strict(),
  z
    .object({
      found: z.literal(true),
      displayHandle: z.string(),
      inboxPubkey: hex32Schema,
      chainId: z.literal(MONAD_TESTNET_CHAIN_ID),
      pools: poolsRecordSchema,
      token: z.literal(CIRCLE_MONAD_TESTNET_USDC),
    })
    .strict(),
]);

export type ResolveResult = z.infer<typeof resolveResultSchema>;

export const encryptedEnvelopeSchema = z
  .object({
    recipientPubkey: hex32Schema,
    ephemeralPubkey: hex32Schema,
    nonce: hex24Schema,
    ciphertext: hexDataSchema,
  })
  .strict();

export type EncryptedEnvelope = z.infer<typeof encryptedEnvelopeSchema>;

export const MAX_CIPHERTEXT_HEX = 2 + 64 * 1024 * 2;

export const walletChallengeRequestSchema = z
  .object({
    address: addressSchema,
    chainId: z.literal(MONAD_TESTNET_CHAIN_ID),
  })
  .strict();

export const walletChallengeResponseSchema = z
  .object({
    challenge: z.string(),
    expiresAt: z.string().datetime(),
  })
  .strict();

export const walletLinkRequestSchema = z
  .object({
    address: addressSchema,
    chainId: z.literal(MONAD_TESTNET_CHAIN_ID),
    signature: hexDataSchema,
    challenge: z.string(),
    inboxSignature: hexDataSchema,
    inboxPubkey: hex32Schema,
  })
  .strict();

export const merklePathRequestSchema = z
  .object({
    pool: addressSchema,
    commitment: hex32Schema,
  })
  .strict();

export const merklePathResponseSchema = z
  .object({
    root: hex32Schema,
    leafIndex: z.number().int().nonnegative(),
    pathElements: z.array(hex32Schema).length(20),
    pathIndices: z.array(z.number().int().min(0).max(1)).length(20),
    blockNumber: z.number().int().positive(),
  })
  .strict();

export const claimPayloadV1Schema = z
  .object({
    v: z.literal(1),
    chainId: z.literal(MONAD_TESTNET_CHAIN_ID),
    pool: addressSchema,
    token: z.literal(CIRCLE_MONAD_TESTNET_USDC),
    denomination: z.enum([
      String(DENOMINATIONS[0]),
      String(DENOMINATIONS[1]),
      String(DENOMINATIONS[2]),
      String(DENOMINATIONS[3]),
    ] as [string, string, string, string]),
    secret: hex32Schema,
    recipientKeyDigest: hex32Schema,
    commitment: hex32Schema,
    depositTxHash: hex32Schema,
  })
  .strict();

export const inviteCreateSchema = z
  .object({
    normalizedHandle: z.string().email().max(320),
    deliveryKind: z.enum(["email"]),
    recipientEmail: z.string().email(),
    claimPayload: claimPayloadV1Schema,
    logIndex: z.number().int().nonnegative(),
    expiresAt: z.string().datetime().optional(),
  })
  .strict();

export const apiErrorCodes = [
  "unauthorized",
  "forbidden",
  "not_found",
  "bad_request",
  "identity_already_linked",
  "invalid_envelope",
  "rate_limited",
  "indexer_syncing",
  "unknown_commitment",
  "nonce_expired",
  "nonce_replayed",
  "last_login_method",
] as const;

export type ApiErrorCode = (typeof apiErrorCodes)[number];

export function apiError(
  code: ApiErrorCode,
  message: string,
): { error: { code: ApiErrorCode; message: string } } {
  return { error: { code, message } };
}
