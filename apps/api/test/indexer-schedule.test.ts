import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nextIndexerCycleDelayMs } from "../src/indexer/run.ts";

describe("indexer cycle scheduling", () => {
  it("immediately runs the next cycle while cursors are advancing", () => {
    assert.equal(nextIndexerCycleDelayMs(true, 4_000, 2_000), 0);
  });

  it("uses the normal poll interval once every cursor reaches the safe head", () => {
    assert.equal(nextIndexerCycleDelayMs(true, 0, 2_000), 2_000);
  });

  it("preserves provider backoff after a failed cycle", () => {
    assert.equal(nextIndexerCycleDelayMs(false, 2_000, 16_000), 16_000);
  });
});
