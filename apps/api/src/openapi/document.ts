import {
  encryptedEnvelopeSchema,
  inviteCreateSchema,
  merklePathRequestSchema,
  walletChallengeRequestSchema,
  walletLinkRequestSchema,
} from "@wisp/shared";
import type { ZodTypeAny } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const bearer = [{ bearerAuth: [] }];

function schema(value: ZodTypeAny): Record<string, unknown> {
  const converted = zodToJsonSchema(value, {
    target: "openApi3",
    $refStrategy: "none",
  }) as Record<string, unknown>;
  delete converted.$schema;
  return converted;
}

function jsonBody(value: ZodTypeAny) {
  return {
    required: true,
    content: { "application/json": { schema: schema(value) } },
  };
}

function response(description: string) {
  return { description, content: { "application/json": { schema: { type: "object" } } } };
}

export function getOpenApiDocument() {
  return {
    openapi: "3.1.0",
    info: {
      title: "Wisp Phase 2 API",
      version: "1.0.0",
      description: "Bearer-authenticated resolver, encrypted delivery, invite, and Merkle path API.",
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "Supabase JWT" },
        adminToken: { type: "apiKey", in: "header", name: "x-admin-token" },
      },
    },
    paths: {
      "/health": { get: { responses: { "200": response("Process is alive") } } },
      "/ready": {
        get: { responses: { "200": response("Dependencies ready"), "503": response("Not ready") } },
      },
      "/v1/me": { get: { security: bearer, responses: { "200": response("Current account") } } },
      "/v1/resolve": {
        get: {
          parameters: [{ name: "q", in: "query", required: true, schema: { type: "string", maxLength: 320 } }],
          responses: { "200": response("Resolver result") },
        },
      },
      "/v1/wallet/challenge": {
        post: {
          security: bearer,
          requestBody: jsonBody(walletChallengeRequestSchema),
          responses: { "200": response("One-use challenge") },
        },
      },
      "/v1/wallet/link": {
        post: {
          security: bearer,
          requestBody: jsonBody(walletLinkRequestSchema),
          responses: { "200": response("Wallet linked") },
        },
      },
      "/v1/handles/{id}": {
        delete: {
          security: bearer,
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { "200": response("Handle unlinked") },
        },
      },
      "/v1/notes": {
        post: {
          security: bearer,
          requestBody: jsonBody(encryptedEnvelopeSchema),
          responses: { "200": response("Encrypted note stored") },
        },
        get: { security: bearer, responses: { "200": response("Encrypted notes") } },
      },
      "/v1/notes/{id}/claimed": {
        post: {
          security: bearer,
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { "200": response("Note marked claimed") },
        },
      },
      "/v1/merkle/path": {
        post: {
          requestBody: jsonBody(merklePathRequestSchema),
          responses: { "200": response("Current contract-known Merkle path") },
        },
      },
      "/v1/invites": {
        post: {
          security: bearer,
          requestBody: jsonBody(inviteCreateSchema),
          responses: { "200": response("Email invite delivered") },
        },
        get: { security: bearer, responses: { "200": response("Sender invite status") } },
      },
      "/v1/activity": {
        post: {
          security: bearer,
          requestBody: jsonBody(encryptedEnvelopeSchema),
          responses: { "200": response("Encrypted activity stored") },
        },
        get: { security: bearer, responses: { "200": response("Encrypted activity") } },
      },
      "/v1/admin/reindex": {
        post: {
          security: [{ adminToken: [] }],
          responses: { "200": response("Durable indexer cache reset") },
        },
      },
    },
  } as const;
}
