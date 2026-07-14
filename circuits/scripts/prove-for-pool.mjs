/**
 * Prove a claim for an empty live pool's first leaf.
 * The note is generated with fresh randomness once and saved locally so the
 * commitment can be deposited before the proof is claimed.
 * Prints JSON: { commitment, root, nullifier, recipientBinding, a, b, c }
 */
import * as snarkjs from "snarkjs";
import { buildPoseidon } from "circomlibjs";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const art = path.join(__dirname, "../artifacts/claim");

const [, , poolHex, chainIdStr, recipientHex, denomStr, notePath] = process.argv;
if (!poolHex || !chainIdStr || !recipientHex || !denomStr || !notePath) {
  console.error(
    "usage: prove-for-pool.mjs <pool> <chainId> <recipient> <denomination> <note-file>"
  );
  process.exit(1);
}

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

const denomination = BigInt(denomStr);
const chainId = BigInt(chainIdStr);
const poolAddress = BigInt(poolHex);
const recipientAddress = BigInt(recipientHex);
const normalized = {
  pool: poolHex.toLowerCase(),
  chainId: chainId.toString(),
  recipient: recipientHex.toLowerCase(),
  denomination: denomination.toString(),
};

function randomFieldElement() {
  // 31 random bytes is strictly below the BN254 scalar field; reject zero.
  let value = 0n;
  while (value === 0n) value = BigInt(`0x${randomBytes(31).toString("hex")}`);
  return value;
}

let secret;
let recipientKeyDigest;
if (fs.existsSync(notePath)) {
  const note = JSON.parse(fs.readFileSync(notePath, "utf8"));
  for (const [key, value] of Object.entries(normalized)) {
    if (note[key] !== value) throw new Error(`note ${key} does not match requested claim`);
  }
  secret = BigInt(note.secret);
  recipientKeyDigest = BigInt(note.recipientKeyDigest);
} else {
  secret = randomFieldElement();
  recipientKeyDigest = randomFieldElement();
  fs.mkdirSync(path.dirname(notePath), { recursive: true });
  fs.writeFileSync(
    notePath,
    `${JSON.stringify({ version: 1, ...normalized, secret: secret.toString(), recipientKeyDigest: recipientKeyDigest.toString() }, null, 2)}\n`,
    { mode: 0o600 }
  );
}

const leaf = H([1n, secret, recipientKeyDigest, denomination, chainId, poolAddress]);
const nullifier = H([2n, secret, recipientKeyDigest, chainId, poolAddress]);
const recipientBinding = H([3n, secret, recipientKeyDigest, recipientAddress]);

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
  pathIndices: pathIndices.map(String),
};

const { proof } = await snarkjs.groth16.fullProve(
  input,
  path.join(art, "claim.wasm"),
  path.join(art, "claim_final.zkey")
);

function hex32(v) {
  return "0x" + BigInt(v).toString(16).padStart(64, "0");
}

// snarkjs proof uses decimal strings; Solidity wants the same ordering as exportSolidityCallData
const meta = {
  commitment: hex32(leaf),
  root: hex32(merkleRoot),
  nullifier: hex32(nullifier),
  recipientBinding: hex32(recipientBinding),
  a: [hex32(proof.pi_a[0]), hex32(proof.pi_a[1])],
  b: [
    [hex32(proof.pi_b[0][1]), hex32(proof.pi_b[0][0])],
    [hex32(proof.pi_b[1][1]), hex32(proof.pi_b[1][0])],
  ],
  c: [hex32(proof.pi_c[0]), hex32(proof.pi_c[1])],
};
const proofPath = `${notePath}.proof.json`;
fs.writeFileSync(proofPath, `${JSON.stringify(meta, null, 2)}\n`, { mode: 0o600 });
meta.proofPath = proofPath;
process.stdout.write(JSON.stringify(meta));
process.exit(0);
