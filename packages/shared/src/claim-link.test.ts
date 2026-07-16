import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseDeploymentManifest } from "./deployment.ts";
import { loadDeploymentManifest } from "./load-deployment.ts";
import { CIRCLE_MONAD_TESTNET_USDC } from "./constants.ts";
import {
  buildClaimUrl,
  decodeClaimPayload,
  encodeClaimPayload,
} from "./claim-link.ts";
import type { ClaimPayloadV1 } from "./field.ts";

const sample: ClaimPayloadV1 = {
  v: 1,
  chainId: 10143,
  pool: `0x${"11".repeat(20)}`,
  token: CIRCLE_MONAD_TESTNET_USDC,
  denomination: "1000000",
  secret: `0x${"01".repeat(32)}`,
  recipientKeyDigest: `0x${"02".repeat(32)}`,
  commitment: `0x${"03".repeat(32)}`,
};


describe("claim-link codec", () => {
  it("round-trips a compact v2 payload without depositTxHash", () => {
    const encoded = encodeClaimPayload(sample);
    const decoded = decodeClaimPayload(encoded);
    assert.equal(decoded.commitment.toLowerCase(), sample.commitment.toLowerCase());
    assert.equal(decoded.secret.toLowerCase(), sample.secret.toLowerCase());
    assert.equal(encoded.length, 158);
  });

  it("builds a compact /c#p= claim URL", () => {
    const url = buildClaimUrl("http://localhost:3000/", sample);
    assert.match(url, /^http:\/\/localhost:3000\/c#p=/);
    const encoded = url.split("#p=")[1]!;
    assert.equal(decodeClaimPayload(encoded).pool.toLowerCase(), sample.pool.toLowerCase());
  });

  it("rejects legacy JSON and malformed compact payloads", () => {
    const legacy = Buffer.from(JSON.stringify(sample)).toString("base64url");
    assert.throws(() => decodeClaimPayload(legacy));
    assert.throws(() => decodeClaimPayload("Ag"));
    assert.throws(() => decodeClaimPayload("***"));
  });
});

describe("parseDeploymentManifest", () => {
  it("parses the committed Monad testnet manifest", () => {
    const loaded = loadDeploymentManifest();
    const parsed = parseDeploymentManifest(JSON.parse(JSON.stringify(loaded)));
    assert.equal(parsed.chainId, 10143);
    assert.equal(parsed.token.decimals, 6);
  });
});
