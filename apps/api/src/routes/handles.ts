import type { FastifyInstance } from "fastify";
import { apiError } from "@wisp/shared";
import { getActiveUser, requireAuth } from "../auth/identity.ts";
import type { AppDeps } from "./health.ts";

export async function registerHandleRoutes(
  app: FastifyInstance,
  deps: AppDeps,
): Promise<void> {
  app.delete("/v1/handles/:id", async (request, reply) => {
    const auth = await requireAuth(deps.config, request);
    if (!auth) {
      return reply.status(401).send(apiError("unauthorized", "Bearer token required"));
    }

    if (!(await getActiveUser(deps.db, auth))) {
      return reply.status(401).send(apiError("unauthorized", "Token revoked"));
    }

    const id = (request.params as { id: string }).id;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return reply.status(400).send(apiError("bad_request", "Invalid handle id"));
    }
    const { data: handle } = await deps.db
      .from("handles")
      .select("id,user_id,is_active")
      .eq("id", id)
      .maybeSingle();

    if (!handle || handle.user_id !== auth.user.id || !handle.is_active) {
      return reply.status(404).send(apiError("not_found", "Handle not found"));
    }

    const { count } = await deps.db
      .from("handles")
      .select("id", { count: "exact", head: true })
      .eq("user_id", auth.user.id)
      .eq("is_active", true);

    if ((count ?? 0) <= 1) {
      return reply
        .status(400)
        .send(apiError("last_login_method", "Cannot remove last login method"));
    }

    const { error } = await deps.db
      .from("handles")
      .update({ is_active: false })
      .eq("id", id)
      .eq("user_id", auth.user.id);
    if (error) {
      return reply.status(500).send(apiError("bad_request", "Delete failed"));
    }

    return { deleted: true };
  });
}
