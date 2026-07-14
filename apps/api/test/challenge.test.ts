import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseWalletChallenge } from "@wisp/crypto";

describe("parseWalletChallenge", () => {
  it("extracts bound fields", () => {
    const fields = parseWalletChallenge(
      "wisp-wallet-link\nversion:1\nuser:abc\naddress:0x1\nchain:10143\nnonce:n1\nissued:2026-01-01T00:00:00.000Z\nexpires:2026-01-01T00:05:00.000Z\norigin:http://localhost:8787",
    );
    assert.equal(fields.user, "abc");
    assert.equal(fields.domain, "wisp-wallet-link");
    assert.equal(fields.nonce, "n1");
    assert.equal(fields.origin, "http://localhost:8787");
  });
});
