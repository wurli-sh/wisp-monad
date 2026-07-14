import { createCipheriv, createHash, randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { noteCommitment, noteNullifier } from "@wisp/crypto";
import {
  apiError,
  fieldToHex,
  hexToField,
  inviteCreateSchema,
  poolByDenom,
} from "@wisp/shared";
import { createPublicClient, decodeEventLog, http, parseAbiItem } from "viem";
import { normalizeHandle } from "../auth/normalize.ts";
import { requireAuth } from "../auth/identity.ts";
import { sendClaimEmail } from "../email/resend.ts";
import { computeNullifierTag } from "../invites/hmac.ts";
import type { RateLimiter } from "../redis/client.ts";
import type { AppDeps } from "./health.ts";

const DEPOSIT_EVENT = parseAbiItem(
  "event Deposit(bytes32 indexed commitment, uint32 indexed leafIndex, bytes32 root)",
);

function encryptAtRest(keysJson: string, plaintext: string): {
  ciphertext: string;
  version: number;
} {
  const keys = JSON.parse(keysJson) as Record<string, string>;
  const versions = Object.keys(keys)
    .map(Number)
    .filter((version) => Number.isInteger(version) && version >= 0)
    .sort((a, b) => a - b);
  const version = versions.at(-1);
  const keyMaterial = version === undefined ? undefined : keys[String(version)];
  if (version === undefined || !keyMaterial || Buffer.byteLength(keyMaterial) < 32) {
    throw new Error("claim payload encryption key ring is invalid");
  }
  const key = createHash("sha256")
    .update("wisp-claim-payload-aes-v1\0")
    .update(keyMaterial, "utf8")
    .digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    ciphertext: Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64"),
    version,
  };
}

export async function registerInviteRoutes(
  app: FastifyInstance,
  deps: AppDeps,
  rateLimiter: RateLimiter,
): Promise<void> {
  app.post("/v1/invites", async (request, reply) => {
    const auth = await requireAuth(deps.config, request);
    if (!auth) {
      return reply.status(401).send(apiError("unauthorized", "Bearer token required"));
    }

    const allowed = await rateLimiter.check(`invites:${auth.user.id}`, 10, 3600);
    if (!allowed) {
      return reply.status(429).send(apiError("rate_limited", "Too many invites"));
    }

    const parsed = inviteCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(apiError("bad_request", "Invalid body"));
    }
    if (
      !deps.config.resendApiKey ||
      !deps.config.resendFromEmail ||
      !deps.config.claimPayloadEncKeysJson ||
      !deps.config.inviteStatusHmacKeysJson
    ) {
      return reply.status(503).send(apiError("bad_request", "Email delivery unavailable"));
    }

    const { claimPayload } = parsed.data;
    const normalizedEmail = normalizeHandle("email", parsed.data.recipientEmail).normalized;
    if (
      normalizeHandle("email", parsed.data.normalizedHandle).normalized !== normalizedEmail
    ) {
      return reply.status(400).send(apiError("bad_request", "Recipient email mismatch"));
    }
    if (parsed.data.expiresAt && Date.parse(parsed.data.expiresAt) <= Date.now()) {
      return reply.status(400).send(apiError("bad_request", "Invite expiry must be in the future"));
    }

    const denomination = BigInt(claimPayload.denomination);
    const expectedPool = poolByDenom(deps.config.manifest, denomination);
    if (
      !expectedPool ||
      expectedPool.toLowerCase() !== claimPayload.pool.toLowerCase() ||
      deps.config.manifest.token.address.toLowerCase() !== claimPayload.token.toLowerCase()
    ) {
      return reply.status(400).send(apiError("bad_request", "Deployment mismatch"));
    }

    let commitment: bigint;
    let nullifier: bigint;
    try {
      const secret = hexToField(claimPayload.secret, "secret");
      const recipientKeyDigest = hexToField(
        claimPayload.recipientKeyDigest,
        "recipientKeyDigest",
      );
      commitment = await noteCommitment({
        secret,
        recipientKeyDigest,
        denomination,
        chainId: BigInt(claimPayload.chainId),
        poolAddress: BigInt(claimPayload.pool),
      });
      nullifier = await noteNullifier({
        secret,
        recipientKeyDigest,
        chainId: BigInt(claimPayload.chainId),
        poolAddress: BigInt(claimPayload.pool),
      });
    } catch {
      return reply.status(400).send(apiError("bad_request", "Invalid claim payload"));
    }
    if (fieldToHex(commitment).toLowerCase() !== claimPayload.commitment.toLowerCase()) {
      return reply.status(400).send(apiError("bad_request", "Commitment mismatch"));
    }

    const client = createPublicClient({ transport: http(deps.config.monadIndexerRpcUrl) });
    let receipt;
    try {
      receipt = await client.getTransactionReceipt({
        hash: claimPayload.depositTxHash as `0x${string}`,
      });
    } catch {
      return reply.status(400).send(apiError("bad_request", "Unknown transaction"));
    }
    const head = await client.getBlockNumber();
    if (receipt.status !== "success" || head < receipt.blockNumber || head - receipt.blockNumber < 5n) {
      return reply.status(400).send(apiError("bad_request", "Deposit not finalized"));
    }

    const depositLog = receipt.logs.find(
      (log) =>
        log.logIndex === parsed.data.logIndex &&
        log.address.toLowerCase() === claimPayload.pool.toLowerCase(),
    );
    if (!depositLog) {
      return reply.status(400).send(apiError("bad_request", "Deposit event mismatch"));
    }
    try {
      const decoded = decodeEventLog({
        abi: [DEPOSIT_EVENT],
        data: depositLog.data,
        topics: depositLog.topics,
      });
      const args = decoded.args as { commitment: `0x${string}` };
      if (args.commitment.toLowerCase() !== claimPayload.commitment.toLowerCase()) {
        throw new Error("commitment mismatch");
      }
    } catch {
      return reply.status(400).send(apiError("bad_request", "Deposit event mismatch"));
    }

    const payloadJson = JSON.stringify(claimPayload);
    const encryptedPayload = encryptAtRest(deps.config.claimPayloadEncKeysJson, payloadJson);
    const nullifierHex = fieldToHex(nullifier).toLowerCase();
    const encryptedNullifier = encryptAtRest(
      deps.config.claimPayloadEncKeysJson,
      nullifierHex,
    );
    const nullifierTag = computeNullifierTag(
      deps.config.inviteStatusHmacKeysJson,
      nullifierHex,
    );
    if (!nullifierTag) {
      return reply.status(503).send(apiError("bad_request", "Invite status unavailable"));
    }

    const { data, error } = await deps.db
      .from("pending_invites")
      .insert({
        sender_user_id: auth.user.id,
        normalized_handle: normalizedEmail,
        delivery_kind: "email",
        encrypted_payload: encryptedPayload.ciphertext,
        encrypted_nullifier: encryptedNullifier.ciphertext,
        nullifier_lookup_tag: nullifierTag,
        crypto_key_version: encryptedPayload.version,
        deposit_chain_id: claimPayload.chainId,
        deposit_pool: claimPayload.pool.toLowerCase(),
        deposit_tx_hash: claimPayload.depositTxHash.toLowerCase(),
        deposit_log_index: parsed.data.logIndex,
        expires_at: parsed.data.expiresAt ?? null,
      })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") {
        return reply.status(409).send(apiError("bad_request", "Invite already sent"));
      }
      return reply.status(500).send(apiError("bad_request", "Insert failed"));
    }

    const webOrigin = deps.config.corsOrigins[0] ?? deps.config.apiOrigin;
    const encodedPayload = Buffer.from(payloadJson, "utf8").toString("base64url");
    const claimUrl = `${webOrigin.replace(/\/$/, "")}/claim#p=${encodedPayload}`;
    let providerMessageId: string;
    try {
      const sent = await sendClaimEmail({
        apiKey: deps.config.resendApiKey,
        from: deps.config.resendFromEmail,
        to: normalizedEmail,
        claimUrl,
      });
      providerMessageId = sent.id;
    } catch {
      deps.log.error({ inviteId: data.id }, "claim email delivery failed");
      await deps.db
        .from("pending_invites")
        .update({ delivery_error: "send_failed" })
        .eq("id", data.id);
      return reply.status(502).send(apiError("bad_request", "Email delivery failed"));
    }

    const { error: updateError } = await deps.db
      .from("pending_invites")
      .update({
        delivered_at: new Date().toISOString(),
        provider_message_id: providerMessageId,
        delivery_error: null,
      })
      .eq("id", data.id);
    if (updateError) {
      deps.log.error({ inviteId: data.id }, "email status persistence failed");
      return reply.status(500).send(apiError("bad_request", "Delivery status persistence failed"));
    }

    return { id: data.id, delivered: true };
  });

  app.get("/v1/invites", async (request, reply) => {
    const auth = await requireAuth(deps.config, request);
    if (!auth) {
      return reply.status(401).send(apiError("unauthorized", "Bearer token required"));
    }

    const { data, error } = await deps.db
      .from("pending_invites")
      .select("id,normalized_handle,delivery_kind,expires_at,delivered_at,claimed_at,created_at")
      .eq("sender_user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      return reply.status(500).send(apiError("bad_request", "Invite lookup failed"));
    }
    return { invites: data ?? [] };
  });
}
