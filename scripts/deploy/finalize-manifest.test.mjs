import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const here = path.dirname(fileURLToPath(import.meta.url));
const finalizer = path.join(here, "finalize-manifest.mjs");
const address = (index) => `0x${index.toString(16).padStart(40, "0")}`;
const hash = (index) => `0x${index.toString(16).padStart(64, "0")}`;

test("finalizer builds a receipt-backed manifest and refuses overwrite", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wisp-deployment-"));
  const deploymentDir = path.join(root, "deployments");
  const broadcastDir = path.join(root, "contracts/broadcast/Deploy.s.sol/10143");
  const circuitDir = path.join(root, "circuits/artifacts/claim");
  fs.mkdirSync(deploymentDir, { recursive: true });
  fs.mkdirSync(broadcastDir, { recursive: true });
  fs.mkdirSync(circuitDir, { recursive: true });

  const deployed = [address(1), address(2), address(3), address(4), address(5), address(6)];
  fs.writeFileSync(
    path.join(deploymentDir, "10143.pending.json"),
    JSON.stringify({
      chainId: 10143,
      admin: address(99),
      token: "0x534b2f3A21130d7a60830c2Df862319e593943A3",
      verifier: deployed[0],
      poseidon: deployed[1],
      pool1: deployed[2],
      pool10: deployed[3],
      pool50: deployed[4],
      pool100: deployed[5],
    })
  );
  fs.writeFileSync(
    path.join(broadcastDir, "run-latest.json"),
    JSON.stringify({
      transactions: deployed.map((contractAddress, index) => ({
        contractAddress,
        hash: hash(index + 1),
      })),
      receipts: deployed.map((_, index) => ({
        transactionHash: hash(index + 1),
        blockNumber: `0x${(100 + index).toString(16)}`,
      })),
    })
  );
  fs.writeFileSync(
    path.join(circuitDir, "artifacts-manifest.json"),
    JSON.stringify({ artifacts: { zkey: "a".repeat(64), wasm: "b".repeat(64) } })
  );

  const first = spawnSync(process.execPath, [finalizer], {
    env: { ...process.env, WISP_DEPLOYMENT_ROOT: root },
    encoding: "utf8",
  });
  assert.equal(first.status, 0, first.stderr);
  const manifest = JSON.parse(
    fs.readFileSync(path.join(deploymentDir, "10143.json"), "utf8")
  );
  assert.equal(manifest.chainId, 10143);
  assert.equal(manifest.deploymentBlock, 100);
  assert.equal(manifest.pools["100000000"].address, deployed[5]);
  assert.equal(fs.existsSync(path.join(deploymentDir, "10143.pending.json")), false);

  const second = spawnSync(process.execPath, [finalizer], {
    env: { ...process.env, WISP_DEPLOYMENT_ROOT: root },
    encoding: "utf8",
  });
  assert.notEqual(second.status, 0);
  assert.match(second.stderr, /already exists/);
});
