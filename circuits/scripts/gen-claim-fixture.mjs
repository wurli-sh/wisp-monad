/**
 * Generate a real claim fixture proof for Foundry + snarkjs tests.
 * Uses sparse incremental Merkle insertion (depth 20) — not a full 2^20 array.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as snarkjs from "snarkjs";
import { buildPoseidon } from "circomlibjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const circuitRoot = path.join(__dirname, "..");
const art = path.join(circuitRoot, "artifacts/claim");

const poseidon = await buildPoseidon();
const F = poseidon.F;
const H = (arr) => F.toObject(poseidon(arr));

const DEPTH = 20;
const zeros = [];
{
  let z = 0n;
  for (let i = 0; i < DEPTH; i++) {
    zeros.push(z);
    z = H([z, z]);
  }
}

const secret = 123456789n;
const recipientKeyDigest = 987654321n;
const denomination = 1_000_000n;
const chainId = 10143n;
const poolAddress = 0x1111111111111111111111111111111111111111n;
const recipientAddress = 0x2222222222222222222222222222222222222222n;

const leaf = H([1n, secret, recipientKeyDigest, denomination, chainId, poolAddress]);
const nullifier = H([2n, secret, recipientKeyDigest, chainId, poolAddress]);
const recipientBinding = H([3n, secret, recipientKeyDigest, recipientAddress]);

// Sparse insert at index 0
const filled = new Array(DEPTH).fill(0n);
const pathElements = [];
const pathIndices = [];
let currentHash = leaf;
let currentIndex = 0;
for (let level = 0; level < DEPTH; level++) {
  if (currentIndex % 2 === 0) {
    pathIndices.push(0);
    pathElements.push(zeros[level]);
    filled[level] = currentHash;
    currentHash = H([currentHash, zeros[level]]);
  } else {
    pathIndices.push(1);
    pathElements.push(filled[level]);
    currentHash = H([filled[level], currentHash]);
  }
  currentIndex = Math.floor(currentIndex / 2);
}
const merkleRoot = currentHash;

const input = {
  root: merkleRoot.toString(),
  nullifier: nullifier.toString(),
  recipientAddress: recipientAddress.toString(),
  denomination: denomination.toString(),
  chainId: chainId.toString(),
  poolAddress: poolAddress.toString(),
  recipientBinding: recipientBinding.toString(),
  secret: secret.toString(),
  recipientKeyDigest: recipientKeyDigest.toString(),
  pathElements: pathElements.map((e) => e.toString()),
  pathIndices: pathIndices.map((i) => i.toString()),
};

fs.writeFileSync(path.join(art, "fixture_input.json"), JSON.stringify(input, null, 2));

console.log("proving...");
const t0 = Date.now();
const { proof, publicSignals } = await snarkjs.groth16.fullProve(
  input,
  path.join(art, "claim.wasm"),
  path.join(art, "claim_final.zkey")
);
console.log("prove ms:", Date.now() - t0);

const vkey = JSON.parse(fs.readFileSync(path.join(art, "verification_key.json"), "utf8"));
const ok = await snarkjs.groth16.verify(vkey, publicSignals, proof);
console.log("verify:", ok);
if (!ok) process.exit(1);

const calldata = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
fs.writeFileSync(path.join(art, "fixture_calldata.txt"), calldata);
fs.writeFileSync(
  path.join(art, "fixture_proof.json"),
  JSON.stringify(
    { proof, publicSignals, meta: { leaf: leaf.toString(), root: merkleRoot.toString() } },
    null,
    2
  )
);

const hex32 = (value) => `0x${BigInt(value).toString(16).padStart(64, "0")}`;
const foundryFixture = {
  commitment: hex32(leaf),
  root: hex32(merkleRoot),
  nullifier: hex32(nullifier),
  recipientBinding: hex32(recipientBinding),
  recipient: `0x${recipientAddress.toString(16).padStart(40, "0")}`,
  denomination: denomination.toString(),
  chainId: chainId.toString(),
  pool: `0x${poolAddress.toString(16).padStart(40, "0")}`,
  a: [hex32(proof.pi_a[0]), hex32(proof.pi_a[1])],
  b: [
    [hex32(proof.pi_b[0][1]), hex32(proof.pi_b[0][0])],
    [hex32(proof.pi_b[1][1]), hex32(proof.pi_b[1][0])],
  ],
  c: [hex32(proof.pi_c[0]), hex32(proof.pi_c[1])],
};
const foundryFixturePath = path.join(
  circuitRoot,
  "../contracts/test/fixtures/real_proof_10143.json"
);
fs.writeFileSync(foundryFixturePath, `${JSON.stringify(foundryFixture, null, 2)}\n`);
console.log("fixture written; publicSignals", publicSignals.length);
process.exit(0);
