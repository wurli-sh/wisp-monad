import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { claimEmailHtml } from "../src/email/resend.ts";

describe("claim email", () => {
  it("preserves an exact fragment and includes no tracking markup", () => {
    const url = "https://wisp.example/c#p=abc_DEF-123";
    const html = claimEmailHtml(url);
    assert.match(html, new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.doesNotMatch(html, /<img|utm_|query=/i);
    assert.match(html, /email provider can associate/i);
  });

  it("rejects legacy /claim#p= links", () => {
    const url = "https://wisp.example/claim#p=abc_DEF-123";
    assert.throws(() => claimEmailHtml(url));
  });

  it("rejects query-string or non-HTTPS claim links", () => {
    assert.throws(() => claimEmailHtml("https://wisp.example/claim?p=secret"));
    assert.throws(() => claimEmailHtml("http://wisp.example/claim#p=secret"));
  });
});
