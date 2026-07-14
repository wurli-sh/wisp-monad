import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeHandle, parseResolveQuery } from "../src/auth/normalize.ts";

describe("normalizeHandle", () => {
  it("normalizes X handles", () => {
    const out = normalizeHandle("x", "@Alice");
    assert.equal(out.normalized, "alice");
    assert.equal(out.display, "@alice");
  });

  it("rejects non-ASCII and overlong X handles", () => {
    assert.throws(() => normalizeHandle("x", "álîce"));
    assert.throws(() => normalizeHandle("x", "a".repeat(16)));
  });

  it("normalizes email", () => {
    const out = normalizeHandle("email", "  User@Example.COM ");
    assert.equal(out.normalized, "user@example.com");
  });
});

describe("parseResolveQuery", () => {
  it("detects email", () => {
    const out = parseResolveQuery("pay@example.com");
    assert.equal(out.provider, "email");
  });

  it("detects x handle", () => {
    const out = parseResolveQuery("alice");
    assert.equal(out.provider, "x");
    assert.equal(out.normalized, "alice");
  });
});
