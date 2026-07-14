import type { FastifyInstance } from "fastify";
import {
  buildInboxKeyMessage,
  buildWalletChallenge,
  canonicalizeSignature,
  bytesToHex,
  deriveInboxPubkeyFromSignature,
  parseWalletChallenge,
  signatureHash,
} from "@wisp/crypto";
import {
  apiError,
  walletChallengeRequestSchema,
  walletLinkRequestSchema,
} from "@wisp/shared";
import { getAddress, recoverMessageAddress } from "viem";
import {
  challengeHash,
  getActiveUser,
  newNonce,
  nonceHash,
  requireAuth,
  syncIdentity,
} from "../auth/identity.ts";
import type { RateLimiter } from "../redis/client.ts";
import type { AppDeps } from "./health.ts";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export async function registerWalletRoutes(
  app: FastifyInstance,
  deps: AppDeps,
  rateLimiter: RateLimiter,
): Promise<void> {
  app.post("/v1/wallet/challenge", async (request, reply) => {
    const auth = await requireAuth(deps.config, request);
    if (!auth) {
      return reply.status(401).send(apiError("unauthorized", "Bearer token required"));
    }

    const allowed = await rateLimiter.check(`wallet:${auth.user.id}`, 20, 3600);
    if (!allowed) {
      return reply.status(429).send(apiError("rate_limited", "Too many requests"));
    }

    const parsed = walletChallengeRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(apiError("bad_request", "Invalid body"));
    }

    await syncIdentity(deps.db, deps.config, auth);

    let address: `0x${string}`;
    try {
      address = getAddress(parsed.data.address).toLowerCase() as `0x${string}`;
    } catch {
      return reply.status(400).send(apiError("bad_request", "Invalid address"));
    }

    const nonce = newNonce();
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + CHALLENGE_TTL_MS);
    const challenge = buildWalletChallenge({
      domain: "wisp-wallet-link",
      version: "1",
      userId: auth.user.id,
      address,
      chainId: parsed.data.chainId,
      nonce,
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      apiOrigin: deps.config.apiOrigin,
    });

    const { error } = await deps.db.from("wallet_link_nonces").insert({
      user_id: auth.user.id,
      nonce_hash: nonceHash(nonce),
      challenge_hash: challengeHash(challenge),
      expires_at: expiresAt.toISOString(),
    });
    if (error) {
      deps.log.error("nonce insert failed");
      return reply.status(500).send(apiError("bad_request", "Challenge failed"));
    }

    return { challenge, expiresAt: expiresAt.toISOString() };
  });

  app.post("/v1/wallet/link", async (request, reply) => {
    const auth = await requireAuth(deps.config, request);
    if (!auth) {
      return reply.status(401).send(apiError("unauthorized", "Bearer token required"));
    }

    const parsed = walletLinkRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(apiError("bad_request", "Invalid body"));
    }

    const allowed = await rateLimiter.check(`wallet:${auth.user.id}`, 20, 3600);
    if (!allowed) {
      return reply.status(429).send(apiError("rate_limited", "Too many requests"));
    }

    if (!(await getActiveUser(deps.db, auth))) {
      return reply.status(401).send(apiError("unauthorized", "Token revoked"));
    }

    await syncIdentity(deps.db, deps.config, auth);

    let address: `0x${string}`;
    try {
      address = getAddress(parsed.data.address).toLowerCase() as `0x${string}`;
    } catch {
      return reply.status(400).send(apiError("bad_request", "Invalid address"));
    }

    const fields = parseWalletChallenge(parsed.data.challenge);
    if (
      fields.domain !== "wisp-wallet-link" ||
      fields.version !== "1" ||
      fields.user !== auth.user.id ||
      fields.address !== address ||
      fields.chain !== String(parsed.data.chainId) ||
      fields.origin !== deps.config.apiOrigin
    ) {
      return reply.status(400).send(apiError("bad_request", "Challenge mismatch"));
    }
    const issuedAt = fields.issued ? Date.parse(fields.issued) : Number.NaN;
    const expiresAt = fields.expires ? Date.parse(fields.expires) : Number.NaN;
    const now = Date.now();
    if (
      !Number.isFinite(issuedAt) ||
      !Number.isFinite(expiresAt) ||
      expiresAt - issuedAt !== CHALLENGE_TTL_MS ||
      issuedAt > now + 30_000
    ) {
      return reply.status(400).send(apiError("bad_request", "Invalid challenge time"));
    }
    if (expiresAt < now) {
      return reply.status(400).send(apiError("nonce_expired", "Challenge expired"));
    }

    const inboxMessage = buildInboxKeyMessage(auth.user.id, parsed.data.chainId);

    let canonicalWalletSignature: `0x${string}`;
    let canonicalInboxSignature: `0x${string}`;
    try {
      canonicalWalletSignature = bytesToHex(canonicalizeSignature(parsed.data.signature));
      canonicalInboxSignature = bytesToHex(canonicalizeSignature(parsed.data.inboxSignature));
    } catch {
      return reply.status(400).send(apiError("bad_request", "Non-canonical signature"));
    }

    let recoveredWallet: `0x${string}`;
    try {
      recoveredWallet = await recoverMessageAddress({
        message: parsed.data.challenge,
        signature: canonicalWalletSignature,
      });
    } catch {
      return reply.status(400).send(apiError("bad_request", "Invalid signature"));
    }

    if (recoveredWallet.toLowerCase() !== address) {
      return reply.status(400).send(apiError("bad_request", "Signature address mismatch"));
    }

    let recoveredInbox: `0x${string}`;
    try {
      recoveredInbox = await recoverMessageAddress({
        message: inboxMessage,
        signature: canonicalInboxSignature,
      });
    } catch {
      return reply.status(400).send(apiError("bad_request", "Invalid inbox signature"));
    }

    if (recoveredInbox.toLowerCase() !== address) {
      return reply.status(400).send(apiError("bad_request", "Inbox signature address mismatch"));
    }

    const derivedPubkey = deriveInboxPubkeyFromSignature(canonicalInboxSignature);
    if (derivedPubkey.toLowerCase() !== parsed.data.inboxPubkey.toLowerCase()) {
      return reply.status(400).send(apiError("bad_request", "Inbox pubkey mismatch"));
    }

    const { data: existingWallet, error: existingWalletError } = await deps.db
      .from("wallets")
      .select("address,inbox_pubkey")
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (existingWalletError) {
      return reply.status(500).send(apiError("bad_request", "Wallet lookup failed"));
    }
    if (
      existingWallet &&
      existingWallet.address.toLowerCase() === address &&
      existingWallet.inbox_pubkey.toLowerCase() !== derivedPubkey.toLowerCase()
    ) {
      return reply.status(409).send(
        apiError("bad_request", "Wallet returned an unstable inbox-key signature"),
      );
    }

    const nonce = fields.nonce;
    if (!nonce) {
      return reply.status(400).send(apiError("bad_request", "Invalid challenge"));
    }

    const sigHash = signatureHash(canonicalInboxSignature);

    const { data: linked, error: walletErr } = await deps.db.rpc("wisp_link_wallet", {
      p_user_id: auth.user.id,
      p_nonce_hash: nonceHash(nonce),
      p_challenge_hash: challengeHash(parsed.data.challenge),
      p_chain_id: parsed.data.chainId,
      p_address: address,
      p_inbox_pubkey: derivedPubkey.toLowerCase(),
      p_link_signature_hash: sigHash,
    });
    if (walletErr) {
      deps.log.error("wallet link failed");
      return reply.status(409).send(apiError("bad_request", "Wallet link failed"));
    }
    if (!linked) {
      return reply.status(400).send(apiError("nonce_replayed", "Nonce invalid or expired"));
    }

    return { linked: true, inboxPubkey: derivedPubkey };
  });
}
