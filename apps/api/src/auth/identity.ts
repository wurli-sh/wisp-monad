import { createHash, randomBytes } from "node:crypto";
import * as jose from "jose";
import type { FastifyRequest } from "fastify";
import type { AppConfig } from "../config.ts";
import type { Db } from "../db/client.ts";
import { normalizeHandle } from "./normalize.ts";

export type AuthUser = {
  id: string;
  email?: string | undefined;
};

export type AuthContext = {
  user: AuthUser;
  token: string;
};

let jwks: ReturnType<typeof jose.createRemoteJWKSet> | undefined;
let hsSecret: Uint8Array | undefined;

function getVerifier(config: AppConfig) {
  if (config.supabaseJwtSecret) {
    if (!hsSecret) {
      hsSecret = new TextEncoder().encode(config.supabaseJwtSecret);
    }
    return async (token: string) => {
      const { payload } = await jose.jwtVerify(token, hsSecret!, {
        issuer: `${config.supabaseUrl}/auth/v1`,
        audience: "authenticated",
      });
      return payload;
    };
  }
  if (!jwks) {
    const url = new URL("/auth/v1/.well-known/jwks.json", config.supabaseUrl);
    jwks = jose.createRemoteJWKSet(url);
  }
  return async (token: string) => {
    const { payload } = await jose.jwtVerify(token, jwks!, {
      issuer: `${config.supabaseUrl}/auth/v1`,
      audience: "authenticated",
    });
    return payload;
  };
}

export async function verifyBearer(
  config: AppConfig,
  authorization?: string,
): Promise<AuthUser | null> {
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length).trim();
  if (!token) return null;
  try {
    const verify = getVerifier(config);
    const payload = await verify(token);
    const sub = payload.sub;
    if (!sub || typeof sub !== "string") return null;
    const email =
      typeof payload.email === "string" ? payload.email : undefined;
    return { id: sub, email };
  } catch {
    return null;
  }
}

export async function requireAuth(
  config: AppConfig,
  request: FastifyRequest,
): Promise<AuthContext | null> {
  const user = await verifyBearer(config, request.headers.authorization);
  if (!user) return null;
  const token = request.headers.authorization!.slice("Bearer ".length).trim();
  return { user, token };
}

/** Lazy identity sync from Supabase Admin getUser (impl-plan §6.3). */
export async function syncIdentity(
  db: Db,
  config: AppConfig,
  auth: AuthContext,
): Promise<void> {
  const user = await getActiveUser(db, auth);
  if (!user) {
    throw new Error("failed to load user identity");
  }
  const { error: profileError } = await db
    .from("profiles")
    .upsert({ id: user.id, updated_at: new Date().toISOString() });
  if (profileError) throw profileError;

  const identities: Array<{
    provider: "google" | "x" | "email";
    normalized: string;
    display: string;
  }> = [];

  for (const identity of user.identities ?? []) {
    const provider = identity.provider;
    if (provider === "google") {
      const email = identity.identity_data?.email as string | undefined;
      if (email) {
        const norm = normalizeHandle("email", email);
        identities.push({ provider: "google", normalized: norm.normalized, display: norm.display });
      }
    } else if (provider === "email") {
      const email = identity.identity_data?.email as string | undefined;
      if (email) {
        const norm = normalizeHandle("email", email);
        identities.push({ provider: "email", normalized: norm.normalized, display: norm.display });
      }
    } else if (provider === "twitter" || provider === "x") {
      const handle =
        (identity.identity_data?.preferred_username as string | undefined) ??
        (identity.identity_data?.user_name as string | undefined);
      if (handle) {
        const norm = normalizeHandle("x", handle);
        identities.push({ provider: "x", normalized: norm.normalized, display: norm.display });
      }
    }
  }

  if (user.email && !identities.some((i) => i.provider === "email")) {
    const norm = normalizeHandle("email", user.email);
    identities.push({ provider: "email", normalized: norm.normalized, display: norm.display });
  }

  for (const id of identities) {
    const { data: existing } = await db
      .from("handles")
      .select("id,user_id")
      .eq("provider", id.provider)
      .eq("normalized", id.normalized)
      .maybeSingle();

    if (existing && existing.user_id !== user.id) {
      const err = new Error("identity_already_linked");
      (err as Error & { code: string }).code = "identity_already_linked";
      throw err;
    }

    if (!existing) {
      const { error: insertErr } = await db.from("handles").insert({
        user_id: user.id,
        provider: id.provider,
        normalized: id.normalized,
        display: id.display,
      });
      if (insertErr) {
        if (insertErr.code === "23505") {
          const err = new Error("identity_already_linked");
          (err as Error & { code: string }).code = "identity_already_linked";
          throw err;
        }
        throw insertErr;
      }
    }
  }
}

export async function getActiveUser(
  db: Db,
  auth: AuthContext,
): Promise<Awaited<ReturnType<Db["auth"]["getUser"]>>["data"]["user"] | null> {
  const { data, error } = await db.auth.getUser(auth.token);
  if (error || !data.user || data.user.id !== auth.user.id) return null;
  return data.user;
}

export function nonceHash(nonce: string): string {
  return createHash("sha256").update(nonce).digest("hex");
}

export function challengeHash(challenge: string): string {
  return createHash("sha256").update(challenge, "utf8").digest("hex");
}

export function newNonce(): string {
  return randomBytes(32).toString("hex");
}
