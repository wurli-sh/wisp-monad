import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  CIRCLE_MONAD_TESTNET_USDC,
  parseDeploymentManifest,
} from "@wisp/shared";
import { parseTrustedClaimPayload } from "./claim.ts";

const manifest = parseDeploymentManifest(
  JSON.parse(
    readFileSync(new URL("../../../../deployments/10143.json", import.meta.url), "utf8"),
  ) as unknown,
);

const validPayload = {
  v: 1 as const,
  chainId: 10143 as const,
  pool: manifest.pools["1000000"].address,
  token: CIRCLE_MONAD_TESTNET_USDC,
  denomination: "1000000",
  secret: `0x${"11".repeat(32)}`,
  recipientKeyDigest: `0x${"22".repeat(32)}`,
  commitment: `0x${"33".repeat(32)}`,
};

describe("trusted claim payload", () => {
  it("accepts the pool assigned to the payload denomination", () => {
    assert.equal(
      parseTrustedClaimPayload(validPayload, manifest).pool,
      validPayload.pool,
    );
  });

  it("rejects a different deployed pool for the same denomination", () => {
    assert.throws(
      () =>
        parseTrustedClaimPayload(
          {
            ...validPayload,
            pool: manifest.pools["10000000"].address,
          },
          manifest,
        ),
      /trusted deployment/,
    );
  });
});
