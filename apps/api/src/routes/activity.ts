import type { FastifyInstance } from "fastify";
import { envelopeHash } from "@wisp/crypto";
import {
  apiError,
  encryptedEnvelopeSchema,
  MAX_CIPHERTEXT_HEX,
} from "@wisp/shared";
import { requireAuth } from "../auth/identity.ts";
import type { RateLimiter } from "../redis/client.ts";
import type { AppDeps } from "./health.ts";

export async function registerActivityRoutes(
  app: FastifyInstance,
  deps: AppDeps,
  rateLimiter: RateLimiter,
): Promise<void> {
  app.post("/v1/activity", async (request, reply) => {
    const auth = await requireAuth(deps.config, request);
    if (!auth) {
      return reply.status(401).send(apiError("unauthorized", "Bearer token required"));
    }
    const allowed = await rateLimiter.check(`activity:${auth.user.id}`, 60, 60);
    if (!allowed) {
      return reply.status(429).send(apiError("rate_limited", "Too many requests"));
    }

    const parsed = encryptedEnvelopeSchema.safeParse(request.body);
    if (!parsed.success || parsed.data.ciphertext.length > MAX_CIPHERTEXT_HEX) {
      return reply.status(400).send(apiError("invalid_envelope", "Invalid envelope"));
    }
    const { data: wallet, error: walletError } = await deps.db
      .from("wallets")
      .select("inbox_pubkey")
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (walletError) {
      return reply.status(500).send(apiError("bad_request", "Wallet lookup failed"));
    }
    if (!wallet || wallet.inbox_pubkey.toLowerCase() !== parsed.data.recipientPubkey.toLowerCase()) {
      return reply.status(403).send(apiError("forbidden", "Envelope is not for linked inbox"));
    }

    const hash = envelopeHash(parsed.data);
    const { data, error } = await deps.db
      .from("activity")
      .insert({
        user_id: auth.user.id,
        ephemeral_pubkey: parsed.data.ephemeralPubkey.toLowerCase(),
        nonce: parsed.data.nonce.toLowerCase(),
        ciphertext: parsed.data.ciphertext.toLowerCase(),
        envelope_hash: hash,
      })
      .select("id,created_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        return { id: null, duplicate: true };
      }
      return reply.status(500).send(apiError("bad_request", "Insert failed"));
    }

    return { id: data.id, createdAt: data.created_at };
  });

  app.get("/v1/activity", async (request, reply) => {
    const auth = await requireAuth(deps.config, request);
    if (!auth) {
      return reply.status(401).send(apiError("unauthorized", "Bearer token required"));
    }

    const { data, error } = await deps.db
      .from("activity")
      .select("id,ephemeral_pubkey,nonce,ciphertext,created_at")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      return reply.status(500).send(apiError("bad_request", "Activity lookup failed"));
    }
    return { activity: data ?? [] };
  });
}
