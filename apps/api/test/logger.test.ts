import assert from "node:assert/strict";
import { Writable } from "node:stream";
import { describe, it } from "node:test";
import type { AppConfig } from "../src/config.ts";
import { createLogger } from "../src/logger.ts";

describe("privacy log canary", () => {
  it("redacts URLs, bearer tokens, signatures, ciphertext, email, and claim payloads", () => {
    let output = "";
    const destination = new Writable({
      write(chunk, _encoding, callback) {
        output += chunk.toString();
        callback();
      },
    });
    const config = { nodeEnv: "test", logLevel: "info" } as AppConfig;
    const log = createLogger(config, destination);
    log.info({
      req: {
        url: "/claim#p=claim-secret",
        headers: { authorization: "Bearer bearer-secret", cookie: "session-secret" },
        body: {
          signature: "signature-secret",
          inboxSignature: "inbox-signature-secret",
          ciphertext: "ciphertext-secret",
          recipientEmail: "private@example.com",
          claimPayload: { secret: "claim-secret" },
        },
      },
    });
    for (const canary of [
      "claim-secret",
      "bearer-secret",
      "session-secret",
      "signature-secret",
      "ciphertext-secret",
      "private@example.com",
    ]) {
      assert.doesNotMatch(output, new RegExp(canary));
    }
    assert.match(output, /\[REDACTED\]/);
  });
});
