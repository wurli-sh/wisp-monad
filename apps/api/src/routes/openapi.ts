import type { FastifyInstance } from "fastify";
import { getOpenApiDocument } from "../openapi/document.ts";

export async function registerOpenApiRoute(app: FastifyInstance): Promise<void> {
  app.get("/openapi.json", async (_request, reply) => {
    reply.header("Cache-Control", "public, max-age=300");
    return getOpenApiDocument();
  });
}
