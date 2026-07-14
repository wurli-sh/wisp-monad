import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canonicalizeSignature,
  signatureHash,
  buildWalletChallenge,
} from "@wisp/crypto";

describe("canonicalizeSignature", () => {
  it("accepts 65-byte signatures", () => {
    const sig =
      "0x" +
      "1".repeat(64) +
      "2".repeat(64) +
      "1b";
    const out = canonicalizeSignature(sig);
    assert.equal(out.length, 65);
    assert.equal(signatureHash(sig).length, 64);
  });

  it("rejects wrong length", () => {
    assert.throws(() => canonicalizeSignature("0x1234"));
  });

  it("rejects high-s signatures and normalizes a zero recovery id", () => {
    const highS =
      "0x" +
      "1".repeat(64) +
      "fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364140" +
      "1b";
    assert.throws(() => canonicalizeSignature(highS), /low-s/);

    const zeroV = "0x" + "1".repeat(64) + "2".repeat(64) + "00";
    assert.equal(canonicalizeSignature(zeroV).at(-1), 27);
  });
});

describe("buildWalletChallenge", () => {
  it("includes required fields", () => {
    const msg = buildWalletChallenge({
      domain: "wisp-wallet-link",
      version: "1",
      userId: "uuid",
      address: "0x0000000000000000000000000000000000000001",
      chainId: 10143,
      nonce: "abc",
      issuedAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2026-01-01T00:05:00.000Z",
      apiOrigin: "http://localhost:8787",
    });
    assert.match(msg, /nonce:abc/);
    assert.match(msg, /user:uuid/);
  });
});
