import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { parseDeploymentManifest } from "@wisp/shared";
import {
  decodeSentActivity,
  encodeSentActivity,
  type SentActivityPayload,
} from "./activity.ts";

const manifest = parseDeploymentManifest(
  JSON.parse(
    readFileSync(new URL("../../../../deployments/10143.json", import.meta.url), "utf8"),
  ) as unknown,
);

const payload: SentActivityPayload = {
  v: 1 as const,
  kind: "sent" as const,
  recipient: "@recipient",
  displayRecipient: "@recipient",
  denomination: "1000000",
  pool: manifest.pools["1000000"].address as `0x${string}`,
  commitment: `0x${"11".repeat(32)}`,
  depositTxHash: `0x${"22".repeat(32)}`,
  delivery: "registered" as const,
  createdAt: "2026-07-14T00:00:00.000Z",
};

describe("encrypted sent activity", () => {
  it("round trips validated metadata without a claim secret", () => {
    const decoded = decodeSentActivity(encodeSentActivity(payload), manifest);
    assert.deepEqual(decoded, payload);
    assert.equal("secret" in decoded, false);
  });

  it("rejects a denomination/pool mismatch", () => {
    assert.throws(
      () =>
        decodeSentActivity(
          encodeSentActivity({
            ...payload,
            pool: manifest.pools["10000000"].address as `0x${string}`,
          }),
          manifest,
        ),
      /deployment mismatch/,
    );
  });
});
