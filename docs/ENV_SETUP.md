# Wisp environment setup (Phase 2)

Copy `.env.example` → `.env` and fill the sections below.

---

## 1. Supabase (database + auth)

**Where:** [supabase.com](https://supabase.com) → New project (free tier)

### Dashboard → Project Settings → API

| Env var | Where to copy |
|---|---|
| `SUPABASE_URL` | Project URL (`https://xxxxx.supabase.co`) |
| `SUPABASE_ANON_KEY` | `anon` `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` key (**API only**, never in Next.js public env) |

### Dashboard → Project Settings → API → JWT Settings

| Env var | Where to copy |
|---|---|
| `SUPABASE_JWT_SECRET` | JWT Secret (optional; API can use JWKS without it) |

### Apply database migration

```bash
# Option A: Supabase CLI
supabase db push

# Option B: SQL Editor — paste contents of:
# supabase/migrations/20260714120000_phase2_initial.sql
# then supabase/migrations/20260714130000_phase2_hardening.sql
```

### Google OAuth (Phase 2 auth)

**Dashboard → Authentication → Providers → Google**

1. Enable Google
2. Create OAuth client in [Google Cloud Console](https://console.cloud.google.com/apis/credentials):
   - Application type: **Web application**
   - Authorized redirect URI (Supabase shows this):
     ```
     https://<project-ref>.supabase.co/auth/v1/callback
     ```
3. Copy **Client ID** and **Client Secret** into Supabase Google provider settings

**Also enable Email** (magic link / OTP) on the same Providers page for email-only login.

### Web env (Phase 3 Next.js — fill now if you want)

| Env var | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Same as `SUPABASE_URL` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same as `SUPABASE_ANON_KEY` |
| `NEXT_PUBLIC_API_URL` | Your Fastify API URL (local: `http://localhost:8787`) |

---

## 2. Upstash Redis (rate limits)

**Where:** [upstash.com](https://upstash.com) → Create Redis database → **Free** tier (no card)

### Upstash console → your database → REST API

| Env var | Where to copy |
|---|---|
| `REDIS_URL` | `UPSTASH_REDIS_REST_URL` |
| `REDIS_TOKEN` | `UPSTASH_REDIS_REST_TOKEN` |

Required for production `/ready`. In local dev, in-memory rate limiting works if Redis is unset and `NODE_ENV` is not `production`.

---

## 3. Resend (email claim links)

**Where:** [resend.com](https://resend.com) → Sign up (free tier, no card)

### Resend → API Keys

| Env var | Value |
|---|---|
| `RESEND_API_KEY` | Create API key → `re_...` |

### Resend → Domains

1. Add your domain (or use `onboarding@resend.dev` for **testing to your own inbox only**)
2. Add DNS records (SPF/DKIM) at your registrar
3. Verify domain
4. **Disable** click tracking and open tracking on the domain (Resend default is off; confirm in domain settings)

| Env var | Example |
|---|---|
| `RESEND_FROM_EMAIL` | `Wisp <noreply@yourdomain.com>` |

Email invites are skipped if these are empty; other API features still work.

---

## 4. API runtime (local)

```env
# Required
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Recommended
REDIS_URL=https://xxxxx.upstash.io
REDIS_TOKEN=AXxx...
MONAD_INDEXER_RPC_URL=https://testnet-rpc.monad.xyz
CORS_ALLOWED_ORIGINS=http://localhost:3000
API_ORIGIN=http://localhost:8787
PORT=8787

# Invites (optional until testing email flow)
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=Wisp <noreply@yourdomain.com>

# Security (generate random strings)
INDEXER_ADMIN_TOKEN=<random-32+-chars>
CLAIM_PAYLOAD_ENC_KEYS_JSON={"1":"<random-32-char-secret>"}
INVITE_STATUS_HMAC_KEYS_JSON={"1":"<random-32-char-secret>"}

LOG_LEVEL=info
```

Generate secrets:

```bash
openssl rand -hex 32   # for INDEXER_ADMIN_TOKEN, HMAC keys, enc keys
```

---

## 5. Start services

```bash
# Terminal 1 — API
pnpm dev:api

# Terminal 2 — indexer (after migration applied)
pnpm dev:indexer

# Smoke test
pnpm smoke:phase2
```

Before starting services, run the strict provider/chain gate:

```bash
pnpm preflight:phase2
```

It prints only pass/fail metadata, never credentials. It requires both migrations
to be visible, Google + Email auth enabled, at least one real OAuth/OTP test user,
Monad/Circle checks, Redis, and a valid Resend API key.

`/ready` returns 200 only when: database reachable, Redis up, Monad RPC up,
deployment manifest loaded, and all four indexer cursors are fresh and caught up
through the five-confirmation safe head.

For a hosted API, set `NODE_ENV=production`, an HTTPS `API_ORIGIN`, and an exact
HTTPS `CORS_ALLOWED_ORIGINS` list. Production startup rejects wildcard CORS,
localhost origins, missing provider pairs, short admin tokens, and invalid key rings.

---

## Quick checklist

- [ ] Supabase project created
- [ ] Migration applied
- [ ] Google OAuth enabled with redirect URI
- [ ] Email provider enabled
- [ ] `SUPABASE_*` keys in `.env`
- [ ] Upstash Redis created → `REDIS_URL` + `REDIS_TOKEN`
- [ ] Resend API key (+ domain verified for real sends)
- [ ] `INDEXER_ADMIN_TOKEN` set (not default in production)
- [ ] `pnpm dev:api` + `pnpm dev:indexer` running
- [ ] `pnpm preflight:phase2` passes
- [ ] `pnpm smoke:phase2` passes with `/ready` = 200
