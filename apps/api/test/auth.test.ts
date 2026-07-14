import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SignJWT } from "jose";
import type { AppConfig } from "../src/config.ts";
import { verifyBearer } from "../src/auth/identity.ts";

const secret = new TextEncoder().encode("test-jwt-secret-that-is-at-least-32-bytes");
const config = {
  supabaseUrl: "https://project.supabase.co",
  supabaseJwtSecret: new TextDecoder().decode(secret),
} as AppConfig;

async function token(audience: string, issuer = "https://project.supabase.co/auth/v1") {
  return new SignJWT({ email: "user@example.com" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("00000000-0000-4000-8000-000000000001")
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(secret);
}

describe("Supabase bearer verification", () => {
  it("requires the authenticated audience and configured issuer", async () => {
    const valid = await verifyBearer(config, `Bearer ${await token("authenticated")}`);
    assert.equal(valid?.id, "00000000-0000-4000-8000-000000000001");
    assert.equal(await verifyBearer(config, `Bearer ${await token("anon")}`), null);
    assert.equal(
      await verifyBearer(config, `Bearer ${await token("authenticated", "https://attacker.invalid")}`),
      null,
    );
  });
});
