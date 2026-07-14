import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeNullifierTag,
  computeNullifierTags,
} from "../src/invites/hmac.ts";

describe("invite nullifier HMAC rotation", () => {
  it("writes with the newest numeric version and reads every active version", () => {
    const keys = JSON.stringify({
      "10": "b".repeat(32),
      "2": "a".repeat(32),
    });
    const tags = computeNullifierTags(keys, "0x1234");
    assert.equal(tags.length, 2);
    assert.equal(computeNullifierTag(keys, "0x1234"), tags[1]);
    assert.notEqual(tags[0], tags[1]);
  });
});
