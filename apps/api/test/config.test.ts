import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { loadConfig } from "../src/config.ts";

const managed = [
  "NODE_ENV",
  "CORS_ALLOWED_ORIGINS",
  "API_ORIGIN",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "REDIS_URL",
  "REDIS_TOKEN",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "INDEXER_ADMIN_TOKEN",
  "CLAIM_PAYLOAD_ENC_KEYS_JSON",
  "INVITE_STATUS_HMAC_KEYS_JSON",
] as const;
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(managed.map((key) => [key, process.env[key]]));
  Object.assign(process.env, {
    NODE_ENV: "production",
    CORS_ALLOWED_ORIGINS: "https://wisp.example",
    API_ORIGIN: "https://api.wisp.example",
    SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_ANON_KEY: "anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    REDIS_URL: "https://redis.example",
    REDIS_TOKEN: "redis-token",
    RESEND_API_KEY: "re_test",
    RESEND_FROM_EMAIL: "Wisp <noreply@wisp.example>",
    INDEXER_ADMIN_TOKEN: "a".repeat(32),
    CLAIM_PAYLOAD_ENC_KEYS_JSON: JSON.stringify({ 1: "b".repeat(32) }),
    INVITE_STATUS_HMAC_KEYS_JSON: JSON.stringify({ 1: "c".repeat(32) }),
  });
});

afterEach(() => {
  for (const key of managed) {
    const value = saved[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("production config", () => {
  it("rejects wildcard CORS", () => {
    process.env.CORS_ALLOWED_ORIGINS = "*";
    assert.throws(() => loadConfig(), /CORS/);
  });

  it("rejects a short admin token", () => {
    process.env.INDEXER_ADMIN_TOKEN = "short";
    assert.throws(() => loadConfig(), /at least 32 bytes/);
  });

  it("accepts explicit production origins and paired providers", () => {
    const config = loadConfig();
    assert.equal(config.isProduction, true);
    assert.deepEqual(config.corsOrigins, ["https://wisp.example"]);
  });
});
