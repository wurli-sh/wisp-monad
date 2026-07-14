# 2B review

Identity ingestion never accepts client-submitted handles; conflicts return 409. Wallet link now consumes a challenge-hash-bound nonce and upserts the wallet in one database transaction. Bearer verification binds issuer + `authenticated` audience; identity/wallet mutations re-check the token with Supabase Auth.

Residual: X OAuth wiring is deferred until developer app approval. A real Google/email test identity and database migration evidence are still required for the live exit gate.
