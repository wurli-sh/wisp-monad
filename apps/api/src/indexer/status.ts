import type { Db } from "../db/client.ts";

const HEARTBEAT_MAX_AGE_MS = 3 * 60 * 1000;
// Public Monad RPC polling is discrete; a small bounded lag avoids flapping
// readiness while each Merkle response independently verifies its root on-chain.
const MAX_CATCHUP_LAG_BLOCKS = 32n;

/** Indexer liveness from durable cursor heartbeats (shared across HTTP replicas). */
export async function isIndexerReady(
  db: Db,
  pools: readonly string[],
  head?: bigint,
): Promise<boolean> {
  const since = new Date(Date.now() - HEARTBEAT_MAX_AGE_MS).toISOString();
  const { data, error } = await db
    .from("indexer_cursors")
    .select("pool,next_block,updated_at")
    .in("pool", pools.map((pool) => pool.toLowerCase()))
    .gte("updated_at", since);

  if (error) return false;
  if ((data?.length ?? 0) !== pools.length) return false;
  const seen = new Set(data!.map((row) => row.pool.toLowerCase()));
  if (seen.size !== pools.length) return false;
  if (head !== undefined) {
    const safeHead = head > 5n ? head - 5n : 0n;
    if (data!.some((row) => BigInt(row.next_block) + MAX_CATCHUP_LAG_BLOCKS <= safeHead)) {
      return false;
    }
  }
  return true;
}
