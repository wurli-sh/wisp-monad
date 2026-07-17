import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { loadEnvFile } from "node:process";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const args = parseArgs(process.argv.slice(2));
const envPath = resolve(root, args.envFile);

if (!existsSync(envPath)) fail(`missing env file: ${envPath}`);
loadEnvFile(envPath);
args.webOrigin ??= process.env.DEPLOY_WEB_ORIGIN;

const webOrigin = normalizeOrigin(args.webOrigin, "--web-origin");
const renderToken = process.env.RENDER_API_KEY?.trim() || readRenderCliCredential()?.token;
if (!args.dryRun && !renderToken) {
  fail("Render authentication is required; run `render login` or set RENDER_API_KEY");
}

let renderService = args.dryRun
  ? {
      id: "dry-run",
      name: args.renderService,
      url: normalizeOrigin(args.apiOrigin, "--api-origin in dry-run mode"),
    }
  : await findRenderService(renderToken, args.renderService);
if (!renderService && !args.createRender) {
  fail(`Render service not found: ${args.renderService}; pass --create-render for the first deploy`);
}
if (!renderService) {
  const bootstrapOrigin = normalizeOrigin(
    args.apiOrigin ?? `https://${args.renderService}.onrender.com`,
    "bootstrap Render service URL",
  );
  const bootstrapValues = buildRenderValues(bootstrapOrigin, webOrigin);
  renderService = await createRenderService(renderToken, args, bootstrapValues);
}
const apiOrigin = normalizeOrigin(
  args.apiOrigin ?? getRenderServiceUrl(renderService),
  "Render service URL",
);

const renderValues = buildRenderValues(apiOrigin, webOrigin);

const vercelValues = requiredValues([
  ["NEXT_PUBLIC_API_URL", apiOrigin],
  ["NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL],
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY],
  ["NEXT_PUBLIC_MONAD_RPC_URL", process.env.NEXT_PUBLIC_MONAD_RPC_URL ?? process.env.MONAD_INDEXER_RPC_URL],
]);
if (process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim()) {
  vercelValues.set(
    "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID",
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID.trim(),
  );
}

validateProductionValues(renderValues, vercelValues);

if (args.dryRun) {
  console.log(`validated Render service: ${renderService.name}`);
  console.log(`validated API origin: ${apiOrigin}`);
  console.log(`validated web origin: ${webOrigin}`);
  console.log(`Render variables: ${[...renderValues.keys()].join(", ")}`);
  console.log(`Vercel variables: ${[...vercelValues.keys()].join(", ")}`);
} else {
  await syncRenderEnv(renderToken, renderService.id, renderValues);
  syncVercelEnv(vercelValues);

  console.log(`synced Render environment for ${renderService.name}`);
  console.log("synced Vercel production environment");

  if (args.deploy) {
    await renderRequest(renderToken, `/services/${renderService.id}/deploys`, {
      method: "POST",
      body: JSON.stringify({ deployMode: "build_and_deploy" }),
    });
    runVercel(["deploy", "--prod", "--yes", "--cwd", resolve(root, "apps/web")]);
    console.log("triggered Render and Vercel production deployments");
  } else {
    console.log("environment sync complete; pass --deploy to redeploy both services now");
  }
}

function parseArgs(argv) {
  const parsed = {
    apiOrigin: undefined,
    createRender: false,
    deploy: false,
    dryRun: false,
    envFile: ".env",
    renderService: "wisp-monad-api",
    renderOwner: process.env.RENDER_OWNER_ID,
    repo: process.env.RENDER_REPO_URL,
    webOrigin: process.env.DEPLOY_WEB_ORIGIN,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--") continue;
    if (value === "--create-render") parsed.createRender = true;
    else if (value === "--deploy") parsed.deploy = true;
    else if (value === "--dry-run") parsed.dryRun = true;
    else if (value === "--api-origin") parsed.apiOrigin = argv[++index];
    else if (value === "--env-file") parsed.envFile = argv[++index];
    else if (value === "--render-service") parsed.renderService = argv[++index];
    else if (value === "--render-owner") parsed.renderOwner = argv[++index];
    else if (value === "--repo") parsed.repo = argv[++index];
    else if (value === "--web-origin") parsed.webOrigin = argv[++index];
    else fail(`unknown argument: ${value}`);
  }
  return parsed;
}

function buildRenderValues(apiOrigin, webOrigin) {
  const values = requiredValues([
    ["NODE_ENV", "production"],
    ["RUN_INDEXER", "true"],
    ["LOG_LEVEL", process.env.LOG_LEVEL ?? "info"],
    ["MONAD_INDEXER_RPC_URL", process.env.MONAD_INDEXER_RPC_URL],
    ["API_ORIGIN", apiOrigin],
    ["CORS_ALLOWED_ORIGINS", webOrigin],
    ["SUPABASE_URL", process.env.SUPABASE_URL],
    ["SUPABASE_ANON_KEY", process.env.SUPABASE_ANON_KEY],
    ["SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY],
    ["REDIS_URL", process.env.REDIS_URL],
    ["REDIS_TOKEN", process.env.REDIS_TOKEN],
    ["RESEND_API_KEY", process.env.RESEND_API_KEY],
    ["RESEND_FROM_EMAIL", process.env.RESEND_FROM_EMAIL],
    ["CLAIM_PAYLOAD_ENC_KEYS_JSON", process.env.CLAIM_PAYLOAD_ENC_KEYS_JSON],
    ["INVITE_STATUS_HMAC_KEYS_JSON", process.env.INVITE_STATUS_HMAC_KEYS_JSON],
    ["INDEXER_ADMIN_TOKEN", process.env.INDEXER_ADMIN_TOKEN],
  ]);
  return values;
}

function normalizeOrigin(raw, label) {
  if (!raw) fail(`${label} is required`);
  let url;
  try {
    url = new URL(raw);
  } catch {
    fail(`${label} must be a valid HTTPS origin`);
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    fail(`${label} must be an HTTPS origin without a path, query, or fragment`);
  }
  return url.origin;
}

function requiredValues(entries) {
  const values = new Map();
  for (const [key, raw] of entries) {
    const value = raw?.trim();
    if (!value) fail(`missing required deployment value: ${key}`);
    values.set(key, value);
  }
  return values;
}

function validateProductionValues(renderValues, vercelValues) {
  if (Buffer.byteLength(renderValues.get("INDEXER_ADMIN_TOKEN")) < 32) {
    fail("INDEXER_ADMIN_TOKEN must be at least 32 bytes");
  }
  if (renderValues.get("SUPABASE_ANON_KEY") === renderValues.get("SUPABASE_SERVICE_ROLE_KEY")) {
    fail("SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY must be different");
  }
  if (vercelValues.get("NEXT_PUBLIC_SUPABASE_URL") !== renderValues.get("SUPABASE_URL")) {
    fail("frontend and API Supabase URLs are inconsistent");
  }
  if (vercelValues.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") !== renderValues.get("SUPABASE_ANON_KEY")) {
    fail("frontend and API Supabase anon keys are inconsistent");
  }
  if (!renderValues.get("RESEND_API_KEY").startsWith("re_")) {
    fail("RESEND_API_KEY must start with re_");
  }
  for (const key of ["CLAIM_PAYLOAD_ENC_KEYS_JSON", "INVITE_STATUS_HMAC_KEYS_JSON"]) {
    let ring;
    try {
      ring = JSON.parse(renderValues.get(key));
    } catch {
      fail(`${key} must be valid JSON`);
    }
    if (!ring || Array.isArray(ring) || Object.keys(ring).length === 0) {
      fail(`${key} must be a non-empty version-to-secret object`);
    }
    for (const [version, secret] of Object.entries(ring)) {
      if (!/^\d+$/.test(version) || typeof secret !== "string" || Buffer.byteLength(secret) < 32) {
        fail(`${key} must use numeric versions and secrets of at least 32 bytes`);
      }
    }
  }
  if (vercelValues.get("NEXT_PUBLIC_API_URL") !== renderValues.get("API_ORIGIN")) {
    fail("frontend and API origins are inconsistent");
  }
}

async function findRenderService(token, name) {
  const response = await renderRequest(
    token,
    `/services?name=${encodeURIComponent(name)}&type=web_service&limit=20`,
  );
  const services = response.map((entry) => entry.service ?? entry);
  const service = services.find((entry) => entry.name === name);
  if (!service) return null;
  getRenderServiceUrl(service);
  return service;
}

async function createRenderService(token, args, values) {
  const cliCredential = readRenderCliCredential();
  const ownerId = args.renderOwner ?? cliCredential?.workspace;
  const repo = args.repo ?? inferGithubRepo();
  if (!ownerId) fail("missing Render owner; pass --render-owner <workspace-id>");
  if (!repo) fail("missing GitHub repository; pass --repo <https-url>");

  return renderRequest(token, "/services", {
    method: "POST",
    body: JSON.stringify({
      type: "web_service",
      name: args.renderService,
      ownerId,
      repo,
      branch: "main",
      autoDeploy: "yes",
      envVars: [...values].map(([key, value]) => ({ key, value })),
      serviceDetails: {
        runtime: "docker",
        plan: "free",
        region: "singapore",
        numInstances: 1,
        healthCheckPath: "/health",
        envSpecificDetails: {
          dockerContext: ".",
          dockerfilePath: "./apps/api/Dockerfile",
        },
      },
    }),
  });
}

function getRenderServiceUrl(service) {
  const url = service.url ?? service.serviceDetails?.url;
  if (!url) fail(`Render service has no public URL yet: ${service.name}`);
  return url;
}

function inferGithubRepo() {
  const result = spawnSync("git", ["remote", "get-url", "origin"], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.status !== 0) return undefined;
  const remote = result.stdout.trim();
  const sshPath = remote.match(/^[^:]+:([^/]+\/.+?)(?:\.git)?$/)?.[1];
  if (sshPath) return `https://github.com/${sshPath.replace(/\.git$/, "")}`;
  if (remote.startsWith("https://github.com/")) return remote.replace(/\.git$/, "");
  return undefined;
}

function readRenderCliCredential() {
  const path = process.env.RENDER_CLI_CONFIG_PATH ?? join(homedir(), ".render/cli.yaml");
  if (!existsSync(path)) return undefined;
  const config = readFileSync(path, "utf8");
  const token = config.match(/^\s+key:\s*(\S+)\s*$/m)?.[1];
  const workspace = config.match(/^workspace:\s*(\S+)\s*$/m)?.[1];
  return token ? { token, workspace } : undefined;
}

async function syncRenderEnv(token, serviceId, desired) {
  const response = await renderRequest(token, `/services/${serviceId}/env-vars?limit=100`);
  const existing = response.map((entry) => entry.envVar ?? entry);
  const merged = new Map(existing.map(({ key, value }) => [key, value]));
  for (const [key, value] of desired) merged.set(key, value);
  await renderRequest(token, `/services/${serviceId}/env-vars`, {
    method: "PUT",
    body: JSON.stringify([...merged].map(([key, value]) => ({ key, value }))),
  });
}

function syncVercelEnv(values) {
  const projectFile = resolve(root, "apps/web/.vercel/project.json");
  if (!existsSync(projectFile)) {
    fail("Vercel project is not linked; run `vercel link --cwd apps/web` once");
  }
  for (const [key, value] of values) {
    runVercel(
      ["env", "add", key, "production", "--force", "--cwd", resolve(root, "apps/web")],
      `${value}\n`,
    );
  }
}

function runVercel(argv, input) {
  const result = spawnSync("vercel", argv, {
    cwd: root,
    encoding: "utf8",
    input,
    stdio: ["pipe", "pipe", "pipe"],
  });
  if (result.status !== 0) fail(result.stderr.trim() || `vercel ${argv[0]} failed`);
}

async function renderRequest(token, path, init = {}) {
  const response = await fetch(`https://api.render.com/v1${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (!response.ok) {
    const detail = await response.text();
    fail(`Render API ${response.status}: ${detail.slice(0, 300)}`);
  }
  return response.json();
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
