import type { FastifyInstance } from "fastify";
import { timingSafeEqual } from "node:crypto";
import { allPoolAddresses, apiError } from "@wisp/shared";
import type { RateLimiter } from "../redis/client.ts";
import type { AppDeps } from "./health.ts";

export async function registerAdminRoutes(
  app: FastifyInstance,
  deps: AppDeps,
  rateLimiter: RateLimiter,
): Promise<void> {
  app.post("/v1/admin/reindex", async (request, reply) => {
    const token = request.headers["x-admin-token"];
    if (typeof token !== "string" || !safeTokenEqual(token, deps.config.indexerAdminToken)) {
      return reply.status(403).send(apiError("forbidden", "Invalid admin token"));
    }

    const allowed = await rateLimiter.check("admin:reindex", 5, 3600);
    if (!allowed) {
      return reply.status(429).send(apiError("rate_limited", "Too many requests"));
    }

    deps.log.info("admin reindex requested");

    const chainId = deps.config.manifest.chainId;
    for (const pool of allPoolAddresses(deps.config.manifest)) {
      const { error } = await deps.db.rpc("wisp_reset_indexer_pool", {
        p_chain_id: chainId,
        p_pool: pool.toLowerCase(),
        p_deployment_block: deps.config.manifest.deploymentBlock,
      });
      if (error) {
        deps.log.error({ pool }, "admin reindex reset failed");
        return reply.status(500).send(apiError("bad_request", "Reindex reset failed"));
      }
    }

    return { reindexScheduled: true };
  });
}

function safeTokenEqual(actual: string, expected: string): boolean {
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
