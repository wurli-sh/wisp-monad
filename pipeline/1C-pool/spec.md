# 1C: Solidity pool

## Spec
See impl-plan §5.3. Real PoseidonT3 from circomlibjs; WispPool immutable denomination; real Groth16 verifier.

## Results
- Poseidon deposit gas ≈ 916k (≪ 12M gate)
- Claim+transfer gas ≈ 287k (≪ 21M gate)
- Real proof deposit+claim+double-spend+redirect tests green
