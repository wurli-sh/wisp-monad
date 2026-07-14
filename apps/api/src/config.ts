import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import { loadDeploymentManifest } from "@wisp/shared/node";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const rootEnv = join(repoRoot, ".env");
if (existsSync(rootEnv)) loadEnvFile(rootEnv);

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`missing required env: ${name}`);
  return value;
}

function optional(name: string): string | undefined {
  return process.env[name] || undefined;
}

export type AppConfig = {
  nodeEnv: string;
  port: number;
  apiOrigin: string;
  corsAllowAll: boolean;
  corsOrigins: string[];
  logLevel: string;
  supabaseUrl: string;
  supabaseAnonKey?: string | undefined;
  supabaseServiceRoleKey: string;
  supabaseJwtSecret?: string | undefined;
  redisUrl?: string | undefined;
  redisToken?: string | undefined;
  monadIndexerRpcUrl: string;
  indexerAdminToken: string;
  resendApiKey?: string | undefined;
  resendFromEmail?: string | undefined;
  claimPayloadEncKeysJson?: string | undefined;
  inviteStatusHmacKeysJson?: string | undefined;
  deploymentRoot: string;
  manifest: ReturnType<typeof loadDeploymentManifest>;
  isProduction: boolean;
};

export function loadConfig(): AppConfig {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const isProduction = nodeEnv === "production";
  const deploymentRoot = optional("WISP_DEPLOYMENT_ROOT") ?? repoRoot;

  const corsRaw = optional("CORS_ALLOWED_ORIGINS") ?? "http://localhost:3000";
  const corsAllowAll = corsRaw.trim() === "*";
  const corsOrigins = corsAllowAll
    ? []
    : corsRaw.split(",").map((s) => s.trim()).filter(Boolean);

  const manifest = loadDeploymentManifest(deploymentRoot);
  const port = Number(optional("PORT") ?? "8787");
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  const apiOrigin = optional("API_ORIGIN") ?? `http://localhost:${port}`;
  assertHttpUrl(apiOrigin, "API_ORIGIN");
  for (const origin of corsOrigins) assertHttpUrl(origin, "CORS_ALLOWED_ORIGINS");

  const redisUrl = optional("REDIS_URL");
  const redisToken = optional("REDIS_TOKEN");
  if (Boolean(redisUrl) !== Boolean(redisToken)) {
    throw new Error("REDIS_URL and REDIS_TOKEN must be configured together");
  }

  const resendApiKey = optional("RESEND_API_KEY");
  const resendFromEmail = optional("RESEND_FROM_EMAIL");
  if (Boolean(resendApiKey) !== Boolean(resendFromEmail)) {
    throw new Error("RESEND_API_KEY and RESEND_FROM_EMAIL must be configured together");
  }
  if (resendApiKey && !resendApiKey.startsWith("re_")) {
    throw new Error("RESEND_API_KEY must be a Resend API key");
  }

  if (isProduction) {
    if (corsAllowAll || corsOrigins.length === 0) {
      throw new Error("production CORS requires an exact non-empty allowlist");
    }
    if (new URL(apiOrigin).hostname === "localhost") {
      throw new Error("production API_ORIGIN cannot use localhost");
    }
    if (!redisUrl || !redisToken) throw new Error("Redis is required in production");
    if (!resendApiKey || !resendFromEmail) throw new Error("Resend is required in production");
    const anonKey = required("SUPABASE_ANON_KEY");
    if (anonKey === required("SUPABASE_SERVICE_ROLE_KEY")) {
      throw new Error("Supabase anon and service-role keys must be different");
    }
    if (Buffer.byteLength(required("INDEXER_ADMIN_TOKEN")) < 32) {
      throw new Error("INDEXER_ADMIN_TOKEN must be at least 32 bytes in production");
    }
    validateKeyRing(required("CLAIM_PAYLOAD_ENC_KEYS_JSON"), "CLAIM_PAYLOAD_ENC_KEYS_JSON");
    validateKeyRing(required("INVITE_STATUS_HMAC_KEYS_JSON"), "INVITE_STATUS_HMAC_KEYS_JSON");
  }

  return {
    nodeEnv,
    port,
    apiOrigin,
    corsAllowAll,
    corsOrigins,
    logLevel: optional("LOG_LEVEL") ?? "info",
    supabaseUrl: required("SUPABASE_URL"),
    supabaseAnonKey: optional("SUPABASE_ANON_KEY"),
    supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
    supabaseJwtSecret: optional("SUPABASE_JWT_SECRET"),
    redisUrl,
    redisToken,
    monadIndexerRpcUrl:
      optional("MONAD_INDEXER_RPC_URL") ??
      optional("NEXT_PUBLIC_MONAD_RPC_URL") ??
      "https://testnet-rpc.monad.xyz",
    indexerAdminToken: isProduction
      ? required("INDEXER_ADMIN_TOKEN")
      : (optional("INDEXER_ADMIN_TOKEN") ?? "dev-admin-token"),
    resendApiKey,
    resendFromEmail,
    claimPayloadEncKeysJson: optional("CLAIM_PAYLOAD_ENC_KEYS_JSON"),
    inviteStatusHmacKeysJson: optional("INVITE_STATUS_HMAC_KEYS_JSON"),
    deploymentRoot,
    manifest,
    isProduction,
  };
}

function assertHttpUrl(value: string, label: string): void {
  const parsed = new URL(value);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`${label} must contain only http(s) URLs`);
  }
  if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error(`${label} entries must be origins without credentials, paths, queries, or fragments`);
  }
}

function validateKeyRing(raw: string, label: string): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${label} must be valid JSON`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label} must be a version-to-secret object`);
  }
  const entries = Object.entries(parsed as Record<string, unknown>);
  if (entries.length === 0) throw new Error(`${label} must contain at least one key`);
  for (const [version, secret] of entries) {
    if (!/^\d+$/.test(version) || typeof secret !== "string" || Buffer.byteLength(secret) < 32) {
      throw new Error(`${label} keys must use numeric versions and secrets of at least 32 bytes`);
    }
  }
}
