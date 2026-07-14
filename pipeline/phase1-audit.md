# Phase 1 internal audit — 2026-07-14

Scope: Circom claim relation, Groth16 artifacts and setup workflow, TypeScript
field/Poseidon tree, Solidity pool, generated verifier integration, adversarial
tokens, Monad/Circle deployment path, and Phase 1 tests.

This is an internal implementation audit, not an independent security audit.

## Patched findings

| Severity | Finding | Resolution |
|---|---|---|
| High | Claim root lookup linearly scanned 4,096 storage slots | Constant-time occurrence mapping with bounded ring eviction |
| High | Deployer received admin/pauser roles and no safe deploy flow existed | Explicit constructor admin plus deployment-time deployer/admin separation |
| High | Wrong Poseidon bytecode could create permanently unprovable deposits | Runtime code hash pinned in both deployer and pool |
| High | Normal circuit builds reran setup with hardcoded contribution entropy | Explicit randomized rotation mode; normal build validates R1CS hash and reuses canonical zkey |
| High | No Monad/Circle deployment implementation | Fail-closed chain/address/decimals/verifier/role checks, named keystore wrapper, receipt-derived manifest |
| Medium | Artifact manifest omitted constraint count and R1CS integrity | Recorded 12,952 constraints plus R1CS/WASM/zkey/VK/verifier hashes |
| Medium | Real-proof tests mutated only nullifier/recipient | Every public signal is now mutated in snarkjs and Foundry verification tests |
| Medium | No fee-on-transfer/false-return token regression coverage | Added rollback/state-integrity tests |
| Medium | Mock token could be deployed publicly | Constructor restricted to local chain IDs 31337/1337 |
| Medium | `currentRoot()` ABI drifted to `uint256` | Restored locked `bytes32` interface |
| Medium | TypeScript strict check was already failing | Enabled TS-extension imports, added minimal typed circomlib declaration, restored green typecheck |

## Verification evidence

- `pnpm check`: pass.
- Foundry: 31 tests pass, including 256 fuzz runs.
- Circuit tests: real proof verifies; all seven public-signal mutations fail.
- Deployment finalizer: synthetic receipt-backed manifest test passes and
  overwrite is rejected; live receipt-derived Monad Testnet manifest exists.
- `snarkjs zkey verify`: `ZKey Ok` after fresh OS-random rotation.
- Artifact checksums and circuit/web/generated-verifier equality checks pass.
- Default and `deploy` Foundry profiles compile; WispPool runtime is 5,579 bytes.

## Phase 1 exit status

The Monad Testnet broadcast, source verification, and Circle-USDC-funded live
deposit → browser-compatible proof → claim are complete. Phase 1's testnet
execution gate is closed; see `pipeline/1D-deploy/test-results.md` for the
transaction links and gas evidence.

## Residual risk

- Single-team Groth16 setup is testnet-only; mainnet requires a production
  ceremony and independent circuit/contract audit.
- Root-ring rollover is occurrence-safe but not exercised through 4,097 full
  Poseidon deposits locally due cost.
- Circle can pause, blacklist, or upgrade USDC.
- This is still an internal audit; no independent security audit has occurred.
