import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const art = path.join(__dirname, "../artifacts/claim");
const build = path.join(__dirname, "../build/claim");

function sha256File(p) {
  return createHash("sha256").update(fs.readFileSync(p)).digest("hex");
}

const constraints = Number(process.argv[2]);
if (!Number.isSafeInteger(constraints) || constraints <= 0) {
  throw new Error("usage: write-manifest.mjs <positive constraint count>");
}

const publicSignalOrder = [
  "root",
  "nullifier",
  "recipientAddress",
  "denomination",
  "chainId",
  "poolAddress",
  "recipientBinding",
];

const manifest = {
  circuit: "claim",
  version: 1,
  publicSignalOrder,
  domainTags: { NOTE_V1: 1, NULLIFIER_V1: 2, RECIPIENT_V1: 3 },
  treeDepth: 20,
  constraintCeiling: 25000,
  compilers: {
    circom: "2.2.3",
    snarkjs: "0.7.5",
    prime: "bn128",
  },
  artifacts: {
    wasm: sha256File(path.join(art, "claim.wasm")),
    zkey: sha256File(path.join(art, "claim_final.zkey")),
    verificationKey: sha256File(path.join(art, "verification_key.json")),
    solidityVerifier: sha256File(path.join(art, "Groth16Verifier.sol")),
    r1cs: sha256File(path.join(art, "claim.r1cs")),
  },
  constraints,
  r1csBytes: fs.statSync(path.join(art, "claim.r1cs")).size,
};

fs.writeFileSync(path.join(art, "artifacts-manifest.json"), JSON.stringify(manifest, null, 2));
console.log("wrote artifacts-manifest.json");
