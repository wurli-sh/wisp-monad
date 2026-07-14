import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const art = path.join(__dirname, "../artifacts/claim");

test("claim artifacts and fixture exist", () => {
  for (const name of [
    "verification_key.json",
    "Groth16Verifier.sol",
    "claim.wasm",
    "claim_final.zkey",
    "fixture_proof.json",
    "artifacts-manifest.json",
  ]) {
    assert.ok(fs.existsSync(path.join(art, name)), `missing ${name}`);
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(art, "artifacts-manifest.json"), "utf8"));
  assert.deepEqual(manifest.publicSignalOrder, [
    "root",
    "nullifier",
    "recipientAddress",
    "denomination",
    "chainId",
    "poolAddress",
    "recipientBinding",
  ]);
  assert.equal(manifest.constraints, 12952);
  assert.match(manifest.artifacts.r1cs, /^[0-9a-f]{64}$/);
});

test("fixture proof verifies", async () => {
  const snarkjs = await import("snarkjs");
  const vkey = JSON.parse(fs.readFileSync(path.join(art, "verification_key.json"), "utf8"));
  const fixture = JSON.parse(fs.readFileSync(path.join(art, "fixture_proof.json"), "utf8"));
  assert.equal(await snarkjs.groth16.verify(vkey, fixture.publicSignals, fixture.proof), true);
});

test("tampering any public signal fails verification", async () => {
  const snarkjs = await import("snarkjs");
  const vkey = JSON.parse(fs.readFileSync(path.join(art, "verification_key.json"), "utf8"));
  const fixture = JSON.parse(fs.readFileSync(path.join(art, "fixture_proof.json"), "utf8"));
  for (let index = 0; index < fixture.publicSignals.length; index += 1) {
    const signals = [...fixture.publicSignals];
    signals[index] = (BigInt(signals[index]) + 1n).toString();
    assert.equal(
      await snarkjs.groth16.verify(vkey, signals, fixture.proof),
      false,
      `tampered public signal ${index} unexpectedly verified`
    );
  }
});
