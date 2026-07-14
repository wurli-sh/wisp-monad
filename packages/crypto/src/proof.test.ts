import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { proofToSolidityCalldata } from "./proof.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("proofToSolidityCalldata", () => {
  it("matches Foundry fixture limb ordering from fixture_proof.json", () => {
    const snark = JSON.parse(
      readFileSync(
        join(root, "circuits/artifacts/claim/fixture_proof.json"),
        "utf8",
      ),
    ) as {
      proof: {
        pi_a: [string, string, string];
        pi_b: [[string, string], [string, string], [string, string]];
        pi_c: [string, string, string];
      };
    };
    const foundry = JSON.parse(
      readFileSync(
        join(root, "contracts/test/fixtures/real_proof_10143.json"),
        "utf8",
      ),
    ) as {
      a: [`0x${string}`, `0x${string}`];
      b: [[`0x${string}`, `0x${string}`], [`0x${string}`, `0x${string}`]];
      c: [`0x${string}`, `0x${string}`];
    };

    const converted = proofToSolidityCalldata(snark.proof);
    assert.deepEqual(converted.a, foundry.a);
    assert.deepEqual(converted.b, foundry.b);
    assert.deepEqual(converted.c, foundry.c);
  });
});
