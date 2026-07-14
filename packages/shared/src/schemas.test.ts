import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CIRCLE_MONAD_TESTNET_USDC } from "./constants.ts";
import {
  encryptedEnvelopeSchema,
  inviteCreateSchema,
} from "./schemas.ts";

describe("security-sensitive API schemas", () => {
  it("rejects odd-length ciphertext and unknown envelope fields", () => {
    const base = {
      recipientPubkey: `0x${"11".repeat(32)}`,
      ephemeralPubkey: `0x${"22".repeat(32)}`,
      nonce: `0x${"33".repeat(24)}`,
      ciphertext: "0x1234",
    };
    assert.equal(encryptedEnvelopeSchema.safeParse(base).success, true);
    assert.equal(
      encryptedEnvelopeSchema.safeParse({ ...base, ciphertext: "0x123" }).success,
      false,
    );
    assert.equal(encryptedEnvelopeSchema.safeParse({ ...base, commitment: "secret" }).success, false);
  });

  it("requires a complete versioned claim payload for email invites", () => {
    const body = {
      normalizedHandle: "recipient@example.com",
      deliveryKind: "email",
      recipientEmail: "recipient@example.com",
      claimPayload: {
        v: 1,
        chainId: 10143,
        pool: `0x${"11".repeat(20)}`,
        token: CIRCLE_MONAD_TESTNET_USDC,
        denomination: "1000000",
        secret: `0x${"01".repeat(32)}`,
        recipientKeyDigest: `0x${"02".repeat(32)}`,
        commitment: `0x${"03".repeat(32)}`,
        depositTxHash: `0x${"04".repeat(32)}`,
      },
      logIndex: 1,
    };
    assert.equal(inviteCreateSchema.safeParse(body).success, true);
    const { claimPayload: _claimPayload, ...missing } = body;
    assert.equal(inviteCreateSchema.safeParse(missing).success, false);
  });
});
