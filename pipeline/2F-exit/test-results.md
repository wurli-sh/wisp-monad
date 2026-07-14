# 2F exit gate

## Patched in audit (2026-07-14)

- Indexer readiness from DB heartbeats (not in-memory HTTP flag)
- Google OAuth emails resolve via `email` + `google` provider lookup
- Wallet link verifies `inboxSignature` + derived inbox pubkey
- Challenge field binding (user, address, chain, origin, expiry)
- Resolve + wallet + admin rate limits
- Merkle path `Cache-Control: no-store`
- Production requires `INDEXER_ADMIN_TOKEN`
- Env guide: `docs/ENV_SETUP.md`
- Atomic wallet-link/indexer RPC migration, durable indexer lease, reorg reset
- Exact Deposit-bound email invites and current-root on-chain path validation
- OpenAPI generated from runtime Zod write schemas
- Fastify/request-validation and transitive dependency advisories patched

## Automated (local)

- `pnpm test:api` — 10 test files pass
- `pnpm --filter @wisp/api typecheck` — pass
- `pnpm check` — pass (31 Foundry tests; circuit/deployment/API/crypto/schema/build gates)
- local API smoke — dependency-independent gates pass; strict readiness correctly returns 503
- `pnpm audit --prod` — one low, unpatchable Circom build-tool advisory; no moderate/high findings
- Docker image build + non-root config runtime — pass

## Live (requires operator setup)

1. Apply both Supabase migrations in timestamp order
2. Configure `.env` with Supabase service role, Redis, Resend
3. `pnpm dev:api` + `pnpm dev:indexer`
4. Google/email OAuth → wallet challenge/link → resolve → deposit → post note → decrypt
5. Restart API/indexer → `POST /v1/merkle/path` still valid

## Evidence

- Unit/integration tests green in CI-equivalent `pnpm test`
- Phase 1 live deposit proof path unchanged (`pnpm smoke:phase1` when funded)

## Current live evidence

- Monad RPC, Circle USDC, Phase 1 verifier/Poseidon/four pools/wiring/roles: pass
- Upstash Redis: pass
- Resend API key: **invalid** (HTTP 401 via REST and official SDK)
- Supabase Email + Google providers: enabled
- Supabase Phase 2 schema: **missing** (PostgREST 404 for `profiles`)
- Real Supabase test user: **missing**

## Status

**Phase 2 is not yet testnet-exit complete.** Code/local/container/chain gates pass, but Phase 3 must wait for the Supabase migrations plus the real OAuth/wallet/encrypted delivery/restart/path flow.
