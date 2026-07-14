# 2D changes

- `src/indexer/run.ts` polls Deposit/Claim with 5-confirmation lag and exponential provider backoff
- Durable renewable lease replaces unsafe session advisory locking through PostgREST
- Sequential index/root validation plus atomic deposit/claim/cursor batch RPC
- Block-hash mismatch resets affected pool leaves/status and replays from deployment
- `POST /v1/merkle/path` builds against latest confirmed root and checks `isKnownRoot` on-chain
- `POST /v1/admin/reindex` transactionally clears reproducible cache state
- Claim nullifiers are matched against every active HMAC key version
