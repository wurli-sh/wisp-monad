import type { FastifyInstance } from "fastify";
import { apiError, MONAD_TESTNET_CHAIN_ID, CIRCLE_MONAD_TESTNET_USDC, poolAddresses } from "@wisp/shared";
import { parseResolveQuery } from "../auth/normalize.ts";
import type { RateLimiter } from "../redis/client.ts";
import type { AppDeps } from "./health.ts";

async function findHandle(
  deps: AppDeps,
  provider: "x" | "email",
  normalized: string,
) {
  if (provider === "email") {
    const { data, error } = await deps.db
      .from("handles")
      .select("display,user_id,provider")
      .in("provider", ["email", "google"])
      .eq("normalized", normalized)
      .eq("is_active", true)
      .limit(1);
    if (error) throw error;
    return data?.[0] ?? null;
  }
  const { data, error } = await deps.db
    .from("handles")
    .select("display,user_id,provider")
    .eq("provider", "x")
    .eq("normalized", normalized)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function registerResolveRoutes(
  app: FastifyInstance,
  deps: AppDeps,
  rateLimiter: RateLimiter,
): Promise<void> {
  app.get("/v1/resolve", async (request, reply) => {
    const ip = request.ip;
    const allowed = await rateLimiter.check(`resolve:${ip}`, 60, 60);
    if (!allowed) {
      return reply.status(429).send(apiError("rate_limited", "Too many requests"));
    }

    const q = (request.query as { q?: string }).q;
    if (!q || q.length > 320) {
      return reply.status(400).send(apiError("bad_request", "Invalid query"));
    }

    let provider: "x" | "email";
    let normalized: string;
    try {
      ({ provider, normalized } = parseResolveQuery(q));
    } catch {
      return reply.status(400).send(apiError("bad_request", "Invalid query"));
    }
    const lookupProvider = provider === "x" ? "x" : "email";
    let handle;
    try {
      handle = await findHandle(deps, lookupProvider, normalized);
    } catch {
      return reply.status(503).send(apiError("bad_request", "Resolver unavailable"));
    }

    if (!handle) {
      return { found: false as const };
    }

    const { data: wallet, error: walletError } = await deps.db
      .from("wallets")
      .select("inbox_pubkey")
      .eq("user_id", handle.user_id)
      .maybeSingle();

    if (walletError) {
      return reply.status(503).send(apiError("bad_request", "Resolver unavailable"));
    }
    if (!wallet) {
      return { found: false as const };
    }

    return {
      found: true as const,
      displayHandle: handle.display,
      inboxPubkey: wallet.inbox_pubkey,
      chainId: MONAD_TESTNET_CHAIN_ID,
      pools: poolAddresses(deps.config.manifest),
      token: CIRCLE_MONAD_TESTNET_USDC,
    };
  });
}
