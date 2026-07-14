# 1C internal audit review

Reviewed 2026-07-14 against `impl-plan.md` sections 4 and 5.3.

## Findings patched

- High: known-root checks scanned up to 4,096 storage slots in every stale or
  invalid claim. Replaced with constant-time occurrence accounting while
  retaining the bounded root ring.
- High: constructors assigned admin and pauser roles to the deployer, while no
  role-transfer deployment existed. The intended admin is now an explicit
  constructor input and is the only initial role holder.
- High: arbitrary Poseidon bytecode could create unprovable roots and lock
  deposits. The pool and deployer now enforce the pinned circomlib runtime hash.
- Medium: `currentRoot()` returned `uint256`, drifting from the locked `bytes32`
  ABI. The external interface now returns `bytes32`.
- Medium: adversarial token and canonical-boundary tests were missing. Added
  fee-on-transfer, false-return, fuzz, and field-boundary cases.
- Medium: `MockUSDC` could be accidentally deployed publicly. Its constructor
  now rejects every chain except local 31337/1337.

## Residual risk

- No independent cryptography or Solidity audit has occurred.
- The 4,096-root rollover behavior is reasoned and occurrence-safe, but a full
  4,097 live-deposit test is intentionally deferred because of its cost.
- Circle issuer pause/blacklist/upgrade controls remain an external dependency.
- Mainnet deployment is forbidden without a production ceremony and audit.
