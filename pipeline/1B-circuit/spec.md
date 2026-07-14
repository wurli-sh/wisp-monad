# 1B: Claim circuit

## Inputs
- Protocol §4.2 with domain tags NOTE_V1=1, NULLIFIER_V1=2, RECIPIENT_V1=3
- Tree depth 20; denominations {1e6,10e6,50e6,100e6}
- Constraint ceiling 25_000

## Outputs
- `circuits/src/claim.circom`
- Build pipeline + artifacts-manifest.json
- Shared `merkle-vectors.json`
- Mutation tests; wasm/zkey copy path for web public assets

## Invariants
- Public signal order locked
- Toxic waste gitignored
- Circuit edit regenerates zkey/verifier/fixtures together

## Out of scope
- WispPool (1C), live deploy (1D)
