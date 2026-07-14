import type { FastifyInstance } from "fastify";
import { allPoolAddresses, fieldToHex, TREE_DEPTH } from "@wisp/shared";
import { IncrementalMerkleTree } from "@wisp/crypto";
import { apiError, merklePathRequestSchema } from "@wisp/shared";
import { createPublicClient, http, parseAbi } from "viem";
import { isIndexerReady } from "../indexer/status.ts";
import type { RateLimiter } from "../redis/client.ts";
import type { AppDeps } from "./health.ts";

const ROOT_ABI = parseAbi(["function isKnownRoot(bytes32 root) view returns (bool)"]);

export async function registerMerkleRoutes(
  app: FastifyInstance,
  deps: AppDeps,
  rateLimiter: RateLimiter,
): Promise<void> {
  app.post("/v1/merkle/path", async (request, reply) => {
    reply.header("Cache-Control", "no-store");

    const parsed = merklePathRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(apiError("bad_request", "Invalid body"));
    }

    const allowed = await rateLimiter.check(`merkle:${request.ip}`, 30, 60);
    if (!allowed) {
      return reply.status(429).send(apiError("rate_limited", "Too many requests"));
    }

    const pools = allPoolAddresses(deps.config.manifest);
    const client = createPublicClient({ transport: http(deps.config.monadIndexerRpcUrl) });
    let head: bigint;
    try {
      head = await client.getBlockNumber();
    } catch {
      return reply.status(409).send(apiError("indexer_syncing", "RPC unavailable"));
    }
    const ready = await isIndexerReady(deps.db, pools, head);
    if (!ready) {
      return reply.status(409).send(apiError("indexer_syncing", "Indexer syncing"));
    }

    const chainId = deps.config.manifest.chainId;
    const pool = parsed.data.pool.toLowerCase();
    const commitment = parsed.data.commitment.toLowerCase();
    if (!pools.some((known) => known.toLowerCase() === pool)) {
      return reply.status(400).send(apiError("bad_request", "Unknown pool"));
    }

    const { data: leaf } = await deps.db
      .from("merkle_leaves")
      .select("leaf_index")
      .eq("chain_id", chainId)
      .eq("pool", pool)
      .eq("commitment", commitment)
      .maybeSingle();

    if (!leaf) {
      return reply.status(404).send(apiError("unknown_commitment", "Unknown commitment"));
    }

    const leaves: Array<{ leaf_index: number; commitment: string; root: string; block_number: number }> = [];
    const pageSize = 1_000;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await deps.db
        .from("merkle_leaves")
        .select("leaf_index,commitment,root,block_number")
        .eq("chain_id", chainId)
        .eq("pool", pool)
        .order("leaf_index", { ascending: true })
        .range(offset, offset + pageSize - 1);
      if (error) {
        deps.log.error("merkle leaf load failed");
        return reply.status(503).send(apiError("indexer_syncing", "Indexer unavailable"));
      }
      leaves.push(...(data ?? []));
      if ((data?.length ?? 0) < pageSize) break;
    }

    if (leaves.length === 0) {
      return reply.status(404).send(apiError("unknown_commitment", "No leaves"));
    }

    if (leaves.some((row, index) => row.leaf_index !== index)) {
      return reply.status(409).send(apiError("indexer_syncing", "Indexer leaf gap"));
    }
    const commitments = leaves.map((row) => BigInt(row.commitment));
    const tree = new IncrementalMerkleTree(TREE_DEPTH);
    const path = await tree.pathForLeafIndex(leaf.leaf_index, commitments);
    const latest = leaves.at(-1)!;
    const root = fieldToHex(path.root).toLowerCase() as `0x${string}`;
    if (root !== latest.root.toLowerCase()) {
      return reply.status(409).send(apiError("indexer_syncing", "Indexer root mismatch"));
    }

    const known = await client.readContract({
      address: pool as `0x${string}`,
      abi: ROOT_ABI,
      functionName: "isKnownRoot",
      args: [root],
    });
    if (!known) {
      return reply.status(409).send(apiError("indexer_syncing", "Root expired on-chain"));
    }

    return {
      root,
      leafIndex: leaf.leaf_index,
      pathElements: path.pathElements.map(
        (v) => `0x${v.toString(16).padStart(64, "0")}`,
      ),
      pathIndices: path.pathIndices,
      blockNumber: Number(latest.block_number),
    };
  });
}
