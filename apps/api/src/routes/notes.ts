import type { FastifyInstance } from "fastify";
import { envelopeHash } from "@wisp/crypto";
import {
  apiError,
  encryptedEnvelopeSchema,
  MAX_CIPHERTEXT_HEX,
} from "@wisp/shared";
import { requireAuth, syncIdentity } from "../auth/identity.ts";
import type { RateLimiter } from "../redis/client.ts";
import type { AppDeps } from "./health.ts";

async function getInboxPubkey(
  deps: AppDeps,
  userId: string,
): Promise<string | null> {
  const { data } = await deps.db
    .from("wallets")
    .select("inbox_pubkey")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.inbox_pubkey ?? null;
}

export async function registerNotesRoutes(
  app: FastifyInstance,
  deps: AppDeps,
  rateLimiter: RateLimiter,
): Promise<void> {
  app.post("/v1/notes", async (request, reply) => {
    const auth = await requireAuth(deps.config, request);
    if (!auth) {
      return reply.status(401).send(apiError("unauthorized", "Bearer token required"));
    }

    const [userAllowed, ipAllowed] = await Promise.all([
      rateLimiter.check(`notes:user:${auth.user.id}`, 30, 60),
      rateLimiter.check(`notes:ip:${request.ip}`, 120, 60),
    ]);
    if (!userAllowed || !ipAllowed) {
      return reply.status(429).send(apiError("rate_limited", "Too many requests"));
    }

    const parsed = encryptedEnvelopeSchema.safeParse(request.body);
    if (!parsed.success || parsed.data.ciphertext.length > MAX_CIPHERTEXT_HEX) {
      return reply.status(400).send(apiError("invalid_envelope", "Invalid envelope"));
    }

    const { data: wallet } = await deps.db
      .from("wallets")
      .select("inbox_pubkey")
      .eq("inbox_pubkey", parsed.data.recipientPubkey.toLowerCase())
      .maybeSingle();

    if (!wallet) {
      return reply.status(400).send(apiError("invalid_envelope", "Unknown recipient key"));
    }

    const hash = envelopeHash(parsed.data);
    const { data, error } = await deps.db
      .from("encrypted_notes")
      .insert({
        recipient_pubkey: parsed.data.recipientPubkey.toLowerCase(),
        ephemeral_pubkey: parsed.data.ephemeralPubkey.toLowerCase(),
        nonce: parsed.data.nonce.toLowerCase(),
        ciphertext: parsed.data.ciphertext.toLowerCase(),
        envelope_hash: hash,
      })
      .select("id,created_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        return reply.status(409).send(apiError("bad_request", "Duplicate envelope"));
      }
      return reply.status(500).send(apiError("bad_request", "Insert failed"));
    }

    return { id: data.id, createdAt: data.created_at };
  });

  app.get("/v1/notes", async (request, reply) => {
    const auth = await requireAuth(deps.config, request);
    if (!auth) {
      return reply.status(401).send(apiError("unauthorized", "Bearer token required"));
    }

    await syncIdentity(deps.db, deps.config, auth);
    const inbox = await getInboxPubkey(deps, auth.user.id);
    if (!inbox) {
      return { notes: [] };
    }

    const { data, error } = await deps.db
      .from("encrypted_notes")
      .select(
        "id,recipient_pubkey,ephemeral_pubkey,nonce,ciphertext,created_at,claimed_at",
      )
      .eq("recipient_pubkey", inbox)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      return reply.status(500).send(apiError("bad_request", "Note lookup failed"));
    }
    return { notes: data ?? [] };
  });

  app.post("/v1/notes/:id/claimed", async (request, reply) => {
    const auth = await requireAuth(deps.config, request);
    if (!auth) {
      return reply.status(401).send(apiError("unauthorized", "Bearer token required"));
    }

    const inbox = await getInboxPubkey(deps, auth.user.id);
    if (!inbox) {
      return reply.status(403).send(apiError("forbidden", "No linked wallet"));
    }

    const id = (request.params as { id: string }).id;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return reply.status(400).send(apiError("bad_request", "Invalid note id"));
    }
    const { data: note } = await deps.db
      .from("encrypted_notes")
      .select("id,recipient_pubkey,claimed_at")
      .eq("id", id)
      .maybeSingle();

    if (!note || note.recipient_pubkey !== inbox) {
      return reply.status(404).send(apiError("not_found", "Note not found"));
    }

    if (!note.claimed_at) {
      const { error } = await deps.db
        .from("encrypted_notes")
        .update({ claimed_at: new Date().toISOString() })
        .eq("id", id)
        .eq("recipient_pubkey", inbox);
      if (error) {
        return reply.status(500).send(apiError("bad_request", "Claim update failed"));
      }
    }

    return { claimed: true };
  });
}
