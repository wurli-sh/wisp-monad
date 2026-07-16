import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decodeClaimPayload, encodeClaimPayload, CIRCLE_MONAD_TESTNET_USDC } from "@wisp/shared";

describe("web claim link unit", () => {
  it("rejects empty decode", () => {
    assert.throws(() => decodeClaimPayload(""));
  });

  it("round trips a payload for claim page", () => {
    const encoded = encodeClaimPayload({
      v: 1,
      chainId: 10143,
      pool: `0x${"ab".repeat(20)}`,
      token: CIRCLE_MONAD_TESTNET_USDC,
      denomination: "1000000",
      secret: `0x${"01".repeat(32)}`,
      recipientKeyDigest: `0x${"02".repeat(32)}`,
      commitment: `0x${"03".repeat(32)}`,
    });
    const decoded = decodeClaimPayload(encoded);
    assert.equal(decoded.denomination, "1000000");
  });
});
