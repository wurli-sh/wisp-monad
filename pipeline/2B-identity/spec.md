# 2B Identity

## Inputs
- `impl-plan.md` §6.2, §6.3
- Migration + auth + wallet routes

## Outputs
- `supabase/migrations/20260714120000_phase2_initial.sql`
- JWT bearer auth + lazy identity sync
- Wallet challenge/link + handle unlink
- `packages/crypto` encryption + signature helpers

## Tests
- API unit tests for normalize/signature
- Crypto encryption round-trip
