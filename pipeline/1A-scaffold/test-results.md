# 1A test results

## Toolchain

```
node v22.22.1
pnpm 10.33.0
circom 2.2.3
snarkjs 0.7.5
forge Version: 1.7.1-monad-v1.0.0
```

## Local Foundry (2026-07-13)

```
Ran 2 tests for test/PoseidonInsertBench.t.sol:PoseidonInsertBenchTest
[PASS] test_insertGasUnderGate() (gas: 510613)
  depth-20 insert gas (stub hasher): 507893
[PASS] test_secondInsertAlsoUnderGate() (gas: 529762)
  second insert gas (stub hasher): 19467

Ran 3 tests for test/ViabilityVerifier.t.sol:ViabilityVerifierTest
[PASS] test_realProofVerifies() (gas: 195901)
[PASS] test_tamperedPublicInputFails() (gas: 195937)
[PASS] test_verifierBytecodeSize() (gas: 7321)
  viability verifier runtime bytecode bytes: 1352
```

Gas gate (insert < 40% of 30M = 12M): PASS with stub hasher (507893). Re-measure with real PoseidonT3 in 1C.

## Circuit tests

```
ok 1 - viability artifacts exist after build
ok 2 - fixture proof verifies with snarkjs
```

## Monad testnet deploy

PENDING — needs funded Foundry keystore (`FOUNDRY_ACCOUNT=wisp-deployer`) and `MONAD_DEPLOY_RPC_URL`.
Record gas limit, gas charged, tx hash, explorer URL here when available.
