# 1D changes

- Added `contracts/script/Deploy.s.sol` with Circle, chain, decimal, Poseidon,
  verifier, denomination, circuit ID, and role assertions.
- Added `scripts/deploy/monad-testnet.sh` using a named Foundry account and
  source verification.
- Added a broadcast-receipt finalizer and `deployments/10143.schema.json`.
- Added unit tests for wrong chain, missing Circle bytecode, zero admin, and the
  exact six-decimal Circle address.
- Disabled Foundry FFI by default.
