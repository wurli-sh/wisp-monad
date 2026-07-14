/**
 * Generate shared merkle-vectors.json (sparse incremental tree).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  emptyRoot,
  IncrementalMerkleTree,
  poseidonHash,
  computeZeroHashes,
} from "../src/poseidon.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEPTH = 20;
const outDir = path.join(__dirname, "../test-vectors");
fs.mkdirSync(outDir, { recursive: true });

const zeros = await computeZeroHashes(DEPTH);
const empty = await emptyRoot(DEPTH);

const tree = new IncrementalMerkleTree(DEPTH);
await tree.init();

const leaves = [
  await poseidonHash([11n, 22n]),
  await poseidonHash([33n, 44n]),
  await poseidonHash([55n, 66n]),
];

const inserts = [];
for (const leaf of leaves) {
  inserts.push(await tree.insert(leaf));
}

const vectors = {
  v: 1,
  field: "bn254",
  hash: "poseidon-circomlib",
  depth: DEPTH,
  zeroLeaf: "0",
  zeros: zeros.map((z) => z.toString()),
  emptyRoot: empty.toString(),
  leaves: leaves.map((l) => l.toString()),
  inserts: inserts.map((ins) => ({
    leafIndex: ins.leafIndex,
    root: ins.root.toString(),
    pathElements: ins.pathElements.map((e) => e.toString()),
    pathIndices: ins.pathIndices,
  })),
};

const outPath = path.join(outDir, "merkle-vectors.json");
fs.writeFileSync(outPath, JSON.stringify(vectors, null, 2));
console.log("wrote", outPath);
