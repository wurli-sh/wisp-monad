# 2E changes

- Resend client in `src/email/resend.ts`
- `POST/GET /v1/invites` recomputes commitment/nullifier, binds exact finalized Deposit log, reserves by event ID, and encrypts payload/nullifier at rest
- `apps/api/Dockerfile`, secret-safe `.dockerignore`, `apps/api/OPS.md`
- `impl-plan.md` + `.env.example` use Resend env vars
