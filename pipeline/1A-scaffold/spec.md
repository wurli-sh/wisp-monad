# 1A: Scaffold and viability gates

## Inputs
- Binding plan: `impl-plan.md` §§3, 5.1
- Tooling: Node 22+, pnpm, Circom 2.2.3, snarkjs 0.7.5, Monad Foundry

## Outputs
- pnpm monorepo + Foundry workspace layout matching §3
- Root scripts including `pnpm check`
- Tiny BN254 Groth16 verifier verified in Foundry and (when funded) on Monad testnet
- Depth-20 Poseidon insertion gas benchmark evidence
- Toolchain versions recorded in README

## Invariants
- `ref/` never imported at runtime
- No deployer keys in repo / env examples
- MockUSDC never referenced for chain 10143

## Files
- Root package/workspace, packages/*, apps/* stubs, circuits/, contracts/, pipeline/, deployments/
- Tiny viability circuit under `circuits/src/viability.circom` (throwaway bench)
- Poseidon insert bench contract under `contracts/src/benchmark/`

## Tests
- Foundry: real tiny-proof verify
- Foundry: Poseidon insert gas snapshot
- Optional testnet: verifier deploy + insert tx (requires funded keystore)

## Out of scope
- Full claim circuit (1B), WispPool (1C), live four-pool deploy (1D)
