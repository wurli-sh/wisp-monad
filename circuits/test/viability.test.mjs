import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const art = path.join(__dirname, "../artifacts/viability");

test("viability artifacts exist after build", () => {
  for (const name of [
    "verification_key.json",
    "ViabilityVerifier.sol",
    "viability.wasm",
    "fixture_proof.json",
  ]) {
    assert.ok(fs.existsSync(path.join(art, name)), `missing ${name}`);
  }
});

test("fixture proof verifies with snarkjs", async () => {
  const snarkjs = await import("snarkjs");
  const vkey = JSON.parse(fs.readFileSync(path.join(art, "verification_key.json"), "utf8"));
  const fixture = JSON.parse(fs.readFileSync(path.join(art, "fixture_proof.json"), "utf8"));
  const ok = await snarkjs.groth16.verify(vkey, fixture.publicSignals, fixture.proof);
  assert.equal(ok, true);
});
