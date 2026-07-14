import type { FastifyInstance } from "fastify";
import { createPublicClient, http } from "viem";
import type { AppConfig } from "../config.ts";
import type { Db } from "../db/client.ts";
import type { Logger } from "../logger.ts";
import { isIndexerReady } from "../indexer/status.ts";
import { allPoolAddresses } from "@wisp/shared";
import { pingRedis } from "../redis/client.ts";

export type AppDeps = {
  config: AppConfig;
  db: Db;
  log: Logger;
};

export async function registerHealthRoutes(
  app: FastifyInstance,
  deps: AppDeps,
): Promise<void> {
  app.get("/health", async () => ({ ok: true }));

  app.get("/ready", async (_req, reply) => {
    let database = false;
    let redis = false;
    let rpc = false;
    let deployment = false;
    let indexer = false;

    try {
      const { error } = await deps.db.from("profiles").select("id").limit(1);
      database = !error;
    } catch {
      database = false;
    }

    try {
      redis = await pingRedis(deps.config);
    } catch {
      redis = false;
    }

    try {
      const client = createPublicClient({
        transport: http(deps.config.monadIndexerRpcUrl),
      });
      const block = await client.getBlockNumber();
      rpc = block > 0n;
      indexer = await isIndexerReady(
        deps.db,
        allPoolAddresses(deps.config.manifest),
        block,
      );
    } catch {
      rpc = false;
    }

    deployment = Boolean(deps.config.manifest.pools["1000000"]?.address);

    const ready = database && redis && rpc && deployment && indexer;
    if (!ready) {
      return reply.status(503).send({ ready: false });
    }
    return { ready: true };
  });
}
