import { randomUUID } from "node:crypto";
import {
  allPoolAddresses,
  fieldToHex,
  hexToField,
  TREE_DEPTH,
} from "@wisp/shared";
import { IncrementalMerkleTree } from "@wisp/crypto";
import {
  createPublicClient,
  decodeEventLog,
  http,
  parseAbiItem,
  type Log,
} from "viem";
import type { AppConfig } from "../config.ts";
import type { Db } from "../db/client.ts";
import type { Logger } from "../logger.ts";
import { computeNullifierTags } from "../invites/hmac.ts";

const DEPOSIT_EVENT = parseAbiItem(
  "event Deposit(bytes32 indexed commitment, uint32 indexed leafIndex, bytes32 root)",
);
const CLAIM_EVENT = parseAbiItem(
  "event Claim(bytes32 indexed nullifier, address indexed recipient)",
);

const CONFIRMATIONS = 5n;
// Monad Testnet's public RPC limits eth_getLogs requests to 100 blocks.
const BLOCK_RANGE = 100n;
// Fetch independent provider-limited ranges concurrently, then commit them as
// one ordered, lease-protected cursor advance.
const LOG_QUERY_BATCHES = 10n;
const LEASE_TTL_SECONDS = 120;

export type IndexerRuntimeState = {
  ready: boolean;
  syncing: boolean;
};

type Client = ReturnType<typeof createPublicClient>;

type DepositRow = {
  leafIndex: number;
  commitment: string;
  root: string;
  blockNumber: number;
  blockHash: string;
  txHash: string;
  logIndex: number;
};

export async function runIndexer(params: {
  config: AppConfig;
  db: Db;
  log: Logger;
  state: IndexerRuntimeState;
  signal: AbortSignal;
}): Promise<void> {
  const { config, db, log, state, signal } = params;
  const chainId = config.manifest.chainId;
  const holderId = randomUUID();
  const client = createPublicClient({ transport: http(config.monadIndexerRpcUrl) });

  while (!signal.aborted && !(await acquireLease(db, holderId))) {
    state.ready = false;
    state.syncing = false;
    log.warn("indexer standby: another replica owns the lease");
    await abortableSleep(10_000, signal);
  }
  if (signal.aborted) return;

  try {
    for (const pool of allPoolAddresses(config.manifest)) {
      await ensureCursor(db, config, pool);
    }

    let failureDelayMs = 2_000;
    while (!signal.aborted) {
      let cycleOk = true;
      let processed = 0;
      state.syncing = true;

      const results = await Promise.all(
        allPoolAddresses(config.manifest).map(async (rawPool) => {
          if (!(await acquireLease(db, holderId))) {
            throw new Error("indexer lease lost");
          }
          const pool = rawPool.toLowerCase() as `0x${string}`;
          try {
            return await processPool({
              config,
              db,
              client,
              chainId,
              pool,
              log,
              holderId,
            });
          } catch {
            log.error({ pool }, "indexer pool processing failed");
            return null;
          }
        }),
      );
      cycleOk = results.every((result) => result !== null);
      processed = results.reduce<number>((total, result) => total + (result ?? 0), 0);

      state.ready = cycleOk;
      state.syncing = !cycleOk || processed > 0;
      if (cycleOk) failureDelayMs = 2_000;
      else failureDelayMs = Math.min(failureDelayMs * 2, 60_000);
      await abortableSleep(cycleOk ? 2_000 : failureDelayMs, signal);
    }
  } finally {
    state.ready = false;
    state.syncing = false;
    await releaseLease(db, holderId);
  }
}

async function acquireLease(db: Db, holderId: string): Promise<boolean> {
  const { data, error } = await db.rpc("wisp_acquire_indexer_lease", {
    p_holder_id: holderId,
    p_ttl_seconds: LEASE_TTL_SECONDS,
  });
  if (error) throw error;
  return data === true;
}

async function releaseLease(db: Db, holderId: string): Promise<void> {
  await db.rpc("wisp_release_indexer_lease", { p_holder_id: holderId });
}

async function ensureCursor(db: Db, config: AppConfig, pool: string): Promise<void> {
  const { error } = await db.from("indexer_cursors").upsert(
    {
      chain_id: config.manifest.chainId,
      pool: pool.toLowerCase(),
      next_block: config.manifest.deploymentBlock,
    },
    { onConflict: "chain_id,pool", ignoreDuplicates: true },
  );
  if (error) throw error;
}

async function processPool(params: {
  config: AppConfig;
  db: Db;
  client: Client;
  chainId: number;
  pool: `0x${string}`;
  log: Logger;
  holderId: string;
}): Promise<number> {
  const { config, db, client, chainId, pool, log, holderId } = params;
  const { data: cursor, error: cursorError } = await db
    .from("indexer_cursors")
    .select("next_block,last_finalized_hash,last_root")
    .eq("chain_id", chainId)
    .eq("pool", pool)
    .single();
  if (cursorError || !cursor) throw cursorError ?? new Error("missing cursor");

  const fromBlock = BigInt(cursor.next_block);
  if (cursor.last_finalized_hash && fromBlock > BigInt(config.manifest.deploymentBlock)) {
    const prior = await client.getBlock({ blockNumber: fromBlock - 1n });
    if (prior.hash?.toLowerCase() !== cursor.last_finalized_hash.toLowerCase()) {
      log.error({ pool, fromBlock: fromBlock.toString() }, "reorg detected; resetting pool cache");
      const { error } = await db.rpc("wisp_reset_indexer_pool", {
        p_chain_id: chainId,
        p_pool: pool,
        p_deployment_block: config.manifest.deploymentBlock,
      });
      if (error) throw error;
      return 0;
    }
  }

  const head = await client.getBlockNumber();
  const safeHead = head > CONFIRMATIONS ? head - CONFIRMATIONS : 0n;
  if (fromBlock > safeHead) {
    return 0;
  }
  const toBlock = fromBlock + (BLOCK_RANGE * LOG_QUERY_BATCHES) - 1n > safeHead
    ? safeHead
    : fromBlock + (BLOCK_RANGE * LOG_QUERY_BATCHES) - 1n;

  const tree = await hydrateTree(db, chainId, pool);
  if (cursor.last_root && fieldToHex(tree.root).toLowerCase() !== cursor.last_root.toLowerCase()) {
    throw new Error("durable cursor root does not match persisted leaves");
  }

  const ranges: Array<{ fromBlock: bigint; toBlock: bigint }> = [];
  for (let start = fromBlock; start <= toBlock; start += BLOCK_RANGE) {
    ranges.push({
      fromBlock: start,
      toBlock: start + BLOCK_RANGE - 1n > toBlock ? toBlock : start + BLOCK_RANGE - 1n,
    });
  }
  const logs = (await Promise.all(
    ranges.map((range) => client.getLogs({
      address: pool,
      ...range,
      events: [DEPOSIT_EVENT, CLAIM_EVENT],
    })),
  )).flat();
  logs.sort(compareLogs);

  const deposits: DepositRow[] = [];
  const claimTags = new Set<string>();
  for (const entry of logs) {
    const decoded = decodeEventLog({
      abi: [DEPOSIT_EVENT, CLAIM_EVENT],
      data: entry.data,
      topics: entry.topics,
    });
    if (decoded.eventName === "Deposit") {
      const args = decoded.args as {
        commitment: `0x${string}`;
        leafIndex: number;
        root: `0x${string}`;
      };
      if (args.leafIndex !== tree.nextLeafIndex) {
        throw new Error(`deposit leaf gap: expected ${tree.nextLeafIndex}, got ${args.leafIndex}`);
      }
      const inserted = await tree.insert(hexToField(args.commitment, "commitment"));
      if (fieldToHex(inserted.root).toLowerCase() !== args.root.toLowerCase()) {
        throw new Error(`deposit root mismatch at leaf ${args.leafIndex}`);
      }
      if (!entry.blockHash || !entry.transactionHash || entry.logIndex == null || !entry.blockNumber) {
        throw new Error("deposit log missing canonical metadata");
      }
      deposits.push({
        leafIndex: args.leafIndex,
        commitment: args.commitment.toLowerCase(),
        root: args.root.toLowerCase(),
        blockNumber: Number(entry.blockNumber),
        blockHash: entry.blockHash.toLowerCase(),
        txHash: entry.transactionHash.toLowerCase(),
        logIndex: entry.logIndex,
      });
    } else {
      const args = decoded.args as { nullifier: `0x${string}` };
      for (const tag of computeNullifierTags(
        config.inviteStatusHmacKeysJson,
        args.nullifier.toLowerCase(),
      )) claimTags.add(tag);
    }
  }

  const finalizedBlock = await client.getBlock({ blockNumber: toBlock });
  if (!finalizedBlock.hash) throw new Error("finalized block missing hash");
  const { data: applied, error: applyError } = await db.rpc("wisp_apply_indexer_batch", {
    p_chain_id: chainId,
    p_pool: pool,
    p_holder_id: holderId,
    p_expected_next_block: Number(fromBlock),
    p_next_block: Number(toBlock + 1n),
    p_last_finalized_hash: finalizedBlock.hash.toLowerCase(),
    p_last_root: fieldToHex(tree.root).toLowerCase(),
    p_deposits: deposits,
    p_claim_tags: [...claimTags],
  });
  if (applyError) throw applyError;
  if (applied !== true) throw new Error("indexer cursor changed concurrently");
  return logs.length;
}

async function hydrateTree(db: Db, chainId: number, pool: string): Promise<IncrementalMerkleTree> {
  const tree = new IncrementalMerkleTree(TREE_DEPTH);
  await tree.init();
  let offset = 0;
  const pageSize = 1_000;
  while (true) {
    const { data, error } = await db
      .from("merkle_leaves")
      .select("leaf_index,commitment,root")
      .eq("chain_id", chainId)
      .eq("pool", pool)
      .order("leaf_index", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    for (const row of data ?? []) {
      if (row.leaf_index !== tree.nextLeafIndex) {
        throw new Error(`persisted leaf gap at ${tree.nextLeafIndex}`);
      }
      const inserted = await tree.insert(hexToField(row.commitment, "commitment"));
      if (fieldToHex(inserted.root).toLowerCase() !== row.root.toLowerCase()) {
        throw new Error(`persisted root mismatch at leaf ${row.leaf_index}`);
      }
    }
    if ((data?.length ?? 0) < pageSize) break;
    offset += pageSize;
  }
  return tree;
}

function compareLogs(a: Log, b: Log): number {
  const block = Number((a.blockNumber ?? 0n) - (b.blockNumber ?? 0n));
  if (block !== 0) return block;
  const tx = (a.transactionIndex ?? 0) - (b.transactionIndex ?? 0);
  if (tx !== 0) return tx;
  return (a.logIndex ?? 0) - (b.logIndex ?? 0);
}

async function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    }
    signal.addEventListener("abort", done, { once: true });
  });
}
