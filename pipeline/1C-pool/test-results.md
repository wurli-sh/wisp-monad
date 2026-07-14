# 1C test results

Audit rerun on 2026-07-14:

```text
forge test -vv
31 passed, 0 failed
real Poseidon deposit gas: 922339
claim plus transfer gas: 286778
unknown-root lookup gas: 7567
redirect recipient: InvalidProof
double claim: NullifierSpent
fee-on-transfer and false-return deposits: reverted with no state change
```
