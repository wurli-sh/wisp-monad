import type { FastifyInstance } from "fastify";
import { apiError } from "@wisp/shared";
import { requireAuth, syncIdentity } from "../auth/identity.ts";
import type { AppDeps } from "./health.ts";

export async function registerMeRoutes(
  app: FastifyInstance,
  deps: AppDeps,
): Promise<void> {
  app.get("/v1/me", async (request, reply) => {
    const auth = await requireAuth(deps.config, request);
    if (!auth) {
      return reply.status(401).send(apiError("unauthorized", "Bearer token required"));
    }

    try {
      await syncIdentity(deps.db, deps.config, auth);
    } catch (err) {
      if ((err as Error & { code?: string }).code === "identity_already_linked") {
        return reply.status(409).send(apiError("identity_already_linked", "Handle already linked"));
      }
      deps.log.error("identity sync failed");
      return reply.status(500).send(apiError("bad_request", "Identity sync failed"));
    }

    const { data: handles } = await deps.db
      .from("handles")
      .select("id,provider,normalized,display,verified_at")
      .eq("user_id", auth.user.id)
      .eq("is_active", true);

    const { data: wallet } = await deps.db
      .from("wallets")
      .select("chain_id,address,inbox_pubkey,linked_at")
      .eq("user_id", auth.user.id)
      .maybeSingle();

    return {
      userId: auth.user.id,
      handles: handles ?? [],
      wallet: wallet ?? null,
    };
  });
}
