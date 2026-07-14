# 1A review

## Security / privacy

- Viability ceremony entropy is local-only and gitignored; not a production setup.
- Stub Poseidon hasher in `PoseidonInsertBench` is explicitly non-protocol — must not ship in WispPool.
- No deployer keys or `.env` secrets committed.

## Risks / follow-ups

- Testnet Groth16 verify gate not yet evidenced on-chain (blocked on funded keystore).
- Real PoseidonT3 insert gas may be materially higher than stub; 1C is the hard insert gate.
- Full claim+transfer < 70% gate deferred to 1C/1D as planned.

## Decision

Continue to 1B while tracking testnet smoke as a 1A incomplete item that must close before Phase 1 exit (can complete during 1D with the real claim verifier).
