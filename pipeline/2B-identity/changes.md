# 2B changes

- Full Phase 2 schema migration with RLS revoke for anon/authenticated
- Advisory lock SQL functions for indexer leader election
- `src/auth/identity.ts` lazy sync from Supabase Admin getUser
- Wallet challenge/link routes with viem recover + canonical signature
- `DELETE /v1/handles/:id` last-login guard
- TweetNaCl envelope + hashToField in `packages/crypto`
