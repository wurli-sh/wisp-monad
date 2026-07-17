# Wisp API operations runbook (Phase 2)

See [docs/ENV_SETUP.md](../../docs/ENV_SETUP.md) for Supabase, Upstash, and Resend setup.

## Processes

- HTTP API: `pnpm dev:api` (port 8787)
- Indexer: `pnpm dev:indexer` (single leader via renewable Postgres lease)

## Environment

Copy `.env.example` and set:

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `REDIS_URL`, `REDIS_TOKEN` (required in production)
- `MONAD_INDEXER_RPC_URL`
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (for email invites)
- `INDEXER_ADMIN_TOKEN`
- `CLAIM_PAYLOAD_ENC_KEYS_JSON`, `INVITE_STATUS_HMAC_KEYS_JSON`
- exact `CORS_ALLOWED_ORIGINS` and `API_ORIGIN`

Run `pnpm preflight:phase2` before starting a testnet deployment. The database
must have both timestamped migrations applied.

## Health

- `GET /health` — liveness only
- `GET /ready` — DB, Redis, RPC, deployment manifest, and all four durable cursor lags

## Recovery

### Reindex Merkle cache

```bash
curl -X POST "$API_URL/v1/admin/reindex" -H "x-admin-token: $INDEXER_ADMIN_TOKEN"
```

Then restart indexer. The reset clears only reproducible leaf/status cache state;
on-chain state is authoritative and the indexer rebuilds from finalized logs.

### Database backup

Use Supabase dashboard backups. After restore, run admin reindex if cursors diverged.

### Graceful shutdown

Send SIGTERM to API/indexer. The API closes Fastify; the indexer releases its
renewable database lease. If a process dies, the lease expires automatically.

## Privacy

Never log claim URLs, bearer tokens, signatures, or ciphertext. Pino redaction is configured in `apps/api/src/logger.ts`.

## Resend

- Free tier: 3,000 emails/mo, 100/day
- Keep click/open tracking disabled on sending domain
- Claim links use `/c#p=...` fragments
