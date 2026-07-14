# 2A: API scaffold

## Inputs
- Binding plan: `impl-plan.md` §6.1, §6.4 (route shell), §6.8
- Phase 2 design: `docs/superpowers/specs/2026-07-14-phase2-backend-design.md`

## Outputs
- `apps/api` Fastify server + indexer entrypoint
- Fail-closed config, Pino redaction, CORS allowlist
- `/health`, `/ready` with DB/Redis/RPC/deployment checks
- Upstash Redis rate-limit client
- Root scripts: `dev:api`, `dev:indexer`, `test:api`

## Provider bootstrap (free tier, no card)
1. **Supabase** — create project; enable Google + Email OTP; copy URL, anon key, service role key
2. **Upstash Redis** — create Free database; copy `REDIS_URL` + `REDIS_TOKEN`
3. **Resend** — create account; verify sending domain; copy API key (used in 2E)

## Invariants
- Service role never in `NEXT_PUBLIC_*`
- `deployments/10143.json` required at startup
- CORS `credentials: false`

## Tests
- Unit: config loader, deployment loader, health routes
- `/ready` returns non-2xx when Redis missing in production mode

## Out of scope
- Auth routes (2B), business routes (2C–2E)
