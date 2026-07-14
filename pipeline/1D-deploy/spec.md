# 1D: Monad testnet deployment specification

Implement the fail-closed deployment path from `impl-plan.md` section 5.4:

- Chain ID exactly 10143.
- Circle USDC exactly `0x534b2f3A21130d7a60830c2Df862319e593943A3`,
  with deployed code and six decimals.
- One generated verifier, one pinned PoseidonT3, and four WispPool instances for
  1, 10, 50, and 100 USDC.
- Explicit admin distinct from the named Foundry deployer; no deployer roles.
- Post-deploy invariant checks, source verification, broadcast-derived final
  manifest, and refusal to overwrite an existing deployment.
- No MockUSDC deployment or fallback on Monad testnet.

Live deployment and faucet-funded smoke testing require external credentials and
are not authorized by implementation alone.
