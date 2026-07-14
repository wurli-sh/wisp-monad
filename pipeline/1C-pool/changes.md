# 1C changes

- `WispPool.sol` with immutable denomination, CEI claim, and a 4,096-root ring.
- Constant-time known-root membership with occurrence counts; no linear claim scan.
- Explicit constructor admin; deployer receives no role unless explicitly chosen.
- Pinned circomlibjs PoseidonT3 runtime code hash and recorded provenance.
- `MockUSDC.sol` restricted to local chain IDs 31337/1337.
- Fee-on-transfer, false-return, canonical-field, role, denomination, fuzz, and
  real-proof mutation coverage.
- Gas: deposit about 0.92M; current-root claim about 0.29M.
