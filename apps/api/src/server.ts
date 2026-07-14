import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { loadConfig } from "./config.ts";
import { createDb } from "./db/client.ts";
import { createLogger } from "./logger.ts";
import { createRateLimiter } from "./redis/client.ts";
import { registerHealthRoutes } from "./routes/health.ts";
import { registerMeRoutes } from "./routes/me.ts";
import { registerResolveRoutes } from "./routes/resolve.ts";
import { registerWalletRoutes } from "./routes/wallet.ts";
import { registerHandleRoutes } from "./routes/handles.ts";
import { registerNotesRoutes } from "./routes/notes.ts";
import { registerActivityRoutes } from "./routes/activity.ts";
import { registerMerkleRoutes } from "./routes/merkle.ts";
import { registerInviteRoutes } from "./routes/invites.ts";
import { registerAdminRoutes } from "./routes/admin.ts";
import { registerOpenApiRoute } from "./routes/openapi.ts";

function buildFastify(config: ReturnType<typeof loadConfig>): FastifyInstance {
  const redact = {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.url",
      "req.body.signature",
      "req.body.inboxSignature",
      "req.body.ciphertext",
      "req.body.recipientEmail",
      "req.body.claimPayload",
      "signature",
      "inboxSignature",
      "ciphertext",
      "email",
      "claimUrl",
      "claimParams",
      "url",
    ],
    censor: "[REDACTED]",
  };

  if (config.nodeEnv === "development") {
    return Fastify({
      bodyLimit: 256 * 1024,
      logger: {
        level: config.logLevel,
        redact,
        transport: { target: "pino-pretty", options: { colorize: true } },
      },
    });
  }

  return Fastify({
    bodyLimit: 256 * 1024,
    logger: { level: config.logLevel, redact },
  });
}

export async function buildServer() {
  const config = loadConfig();
  const log = createLogger(config);
  const db = createDb(config);
  const rateLimiter = createRateLimiter(config);
  const app = buildFastify(config);

  await app.register(cors, {
    origin: config.corsAllowAll ? true : config.corsOrigins,
    credentials: false,
  });

  app.addHook("onRequest", async (request, reply) => {
    const mutation = ["POST", "PUT", "PATCH", "DELETE"].includes(request.method);
    if (mutation && request.url.startsWith("/v1/") && request.headers.cookie) {
      return reply.status(400).send({
        error: { code: "bad_request", message: "API mutations use bearer auth, not cookies" },
      });
    }
  });

  app.addHook("onSend", async (request, reply) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Referrer-Policy", "no-referrer");
    reply.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    if (request.url.startsWith("/v1/") && request.url !== "/v1/resolve") {
      reply.header("Cache-Control", "no-store");
    }
  });

  const deps = { config, db, log };

  await registerHealthRoutes(app, deps);
  await registerOpenApiRoute(app);
  await registerMeRoutes(app, deps);
  await registerResolveRoutes(app, deps, rateLimiter);
  await registerWalletRoutes(app, deps, rateLimiter);
  await registerHandleRoutes(app, deps);
  await registerNotesRoutes(app, deps, rateLimiter);
  await registerActivityRoutes(app, deps, rateLimiter);
  await registerMerkleRoutes(app, deps, rateLimiter);
  await registerInviteRoutes(app, deps, rateLimiter);
  await registerAdminRoutes(app, deps, rateLimiter);

  return { app, config, log };
}

async function main() {
  const { app, config } = await buildServer();
  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    await app.close();
  };
  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
  await app.listen({ port: config.port, host: "0.0.0.0" });
}

main().catch((err) => {
  console.error(
    "API startup failed:",
    err instanceof Error ? err.message : "unknown error",
  );
  process.exit(1);
});
