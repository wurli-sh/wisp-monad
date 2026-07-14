import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MemoryRateLimiter } from "../src/redis/client.ts";

describe("rate limiter", () => {
  it("fails closed after the configured count", async () => {
    const limiter = new MemoryRateLimiter();
    assert.equal(await limiter.check("key", 2, 60), true);
    assert.equal(await limiter.check("key", 2, 60), true);
    assert.equal(await limiter.check("key", 2, 60), false);
  });
});
