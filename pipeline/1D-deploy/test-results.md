# 1D test results

Local validation on 2026-07-14:

```text
bash -n scripts/deploy/monad-testnet.sh: pass
node --check scripts/deploy/finalize-manifest.mjs: pass
DeployTest: 4 passed, 0 failed
finalize-manifest.test.mjs: 1 passed, 0 failed
FOUNDRY_PROFILE=deploy forge build --force: pass
```

## Live Monad Testnet deployment — 2026-07-14

Deployment succeeded from the funded named keystore on chain `10143`.

| Component | Address | Transaction | Block |
|---|---|---|---:|
| PoseidonT3 | `0xbAb52Fb2e83C250D7f9e86eEa76E8D49D63C79c3` | `0x6033285bdd41583ba80715e40e34b18d7d0095b7d87f461c61b7669c68c1567e` | 44778621 |
| Groth16Verifier | `0x1026346d75D10FEa3340361DC6C288E25DB46C3A` | `0x0e6856ef9db33d5c90cc935c9dbfde1671d2704589ec6d7a70b6e7f6a94a33b0` | 44778631 |
| 1 USDC pool | `0x919B3eF692eCD2F14d3402Cfe0015E4D7d8D9d3d` | `0x1a09d84225b36c8cd8c3f763f8e1a7c95c9e2769ecd9298714f127dc36acd324` | 44778640 |
| 10 USDC pool | `0x3B69E0B1A5Ea9Ab53B474ee087a71B48377D700c` | `0xcd7ad4daeb6b2fb1992ce118af83c204f35aa294c3d57c8134a40940c90cf1e2` | 44778644 |
| 50 USDC pool | `0xb3f5cEC6b9D4462756477c1268E01C8525C6Dc8c` | `0x77dccced4d0c3315afd96c64ba651d42b73eb1db7efa472c81b541808a43b317` | 44778654 |
| 100 USDC pool | `0xe50Ae387881943c7e4149cEF0873cf4D5F37fFD0` | `0x4a8414cdd7bb2970587e467031d5ea3fa0de8d49c54bc215531850b4372d3a86` | 44778657 |

- Broadcast total: `2.072376049144886496 MON` / `20,107,131` gas.
- Groth16Verifier and all four WispPool instances verified against MonadVision
  Sourcify with status `match`.
- PoseidonT3 is raw deployed bytecode; its on-chain code hash is
  `0x354b26999e434f8256d168395315e1f51fc15bf49bf2e6bb58fc549bd597e7da`,
  matching the pinned pool invariant.
- Read-only post-deploy checks confirmed Circle USDC, verifier, Poseidon,
  denominations `1/10/50/100` USDC, and the configured admin has both admin
  and pauser roles on every pool.
- Canonical receipt-derived manifest: `deployments/10143.json`.

The completed live user-signed deposit, browser-compatible proof, and claim
evidence is recorded below.

## Live 1-USDC deposit → proof → claim — 2026-07-14

The first-leaf smoke flow completed successfully against the deployed 1-USDC
pool. The proof was generated from the canonical browser-compatible WASM/zkey
artifacts, verified by the deployed Groth16 verifier before submission, and
claimed to `0x565e41a4DAa0B2E7527A6F6353dD3baD043BF72f`.

| Action | Transaction | Block | Gas |
|---|---|---:|---:|
| Exact 1-USDC approval | `0xdcfabc248180d751c910f72c27f662c2265b9b81c10673f0c4a2ba20d4d932a4` | 44781097 | 87,844 |
| Deposit commitment | `0x805a3fa7204458a9aeca760cbe0e635cf46efa1f571de60bd405cb702965316c` | 44781127 | 1,306,410 |
| Groth16 claim | `0x54a39303d722967e165d3702bb0530c4ef20652e764c51b219ad685043081a79` | 44781148 | 1,318,775 |

- Deposit commitment: `0x0eb7a9d9fff7df02750409ac9c9bfecb1f763b9e6ceca3514ea1c6d59b59122e`.
- Claimed nullifier: `0x1477fab6e233b9b7703adc1fd396eec319c418d16dbd2319bc298d2fcb558571`.
- Recipient balance after claim: `1,000,000` USDC units (`1 USDC`).
- The replay guard now observes a non-empty first leaf and refuses a second
  execution before any signing or transaction submission.

Phase 1's testnet execution gate is complete. This remains hackathon/testnet
evidence, not a production security audit or mainnet readiness claim.
