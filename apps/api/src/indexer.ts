import { loadConfig } from "./config.ts";
import { createDb } from "./db/client.ts";
import { createLogger } from "./logger.ts";
import { runIndexer } from "./indexer/run.ts";

async function main() {
  const config = loadConfig();
  const log = createLogger(config);
  const db = createDb(config);
  const state = { ready: false, syncing: true };
  const controller = new AbortController();

  process.on("SIGINT", () => controller.abort());
  process.on("SIGTERM", () => controller.abort());

  log.info("indexer starting");
  await runIndexer({
    config,
    db,
    log,
    state,
    signal: controller.signal,
  });
}

main().catch(() => {
  console.error("indexer terminated unexpectedly; inspect structured logs");
  process.exit(1);
});
