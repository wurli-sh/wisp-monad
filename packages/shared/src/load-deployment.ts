import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MONAD_TESTNET_CHAIN_ID } from "./constants.ts";
import {
  parseDeploymentManifest,
  type DeploymentManifest,
} from "./deployment.ts";

/** Node-only: read deployments/{chainId}.json from disk. */
export function loadDeploymentManifest(
  rootDir?: string,
): DeploymentManifest {
  const base =
    rootDir ??
    join(dirname(fileURLToPath(import.meta.url)), "../../..");
  const path = join(base, "deployments", `${MONAD_TESTNET_CHAIN_ID}.json`);
  const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
  return parseDeploymentManifest(raw);
}
