# 1B changes

- Implemented `circuits/src/claim.circom` (§4.2, domain tags 1/2/3)
- Constraints: 12,952 (ceiling 25,000)
- Ceremony build + artifacts-manifest + wasm/zkey copy to `apps/web/public/circuits`
- Fixture prove ~766ms (browser target OK)
- Shared sparse Merkle vectors in `packages/crypto/test-vectors/merkle-vectors.json`
- Domain tags written into `impl-plan.md` §4.2
