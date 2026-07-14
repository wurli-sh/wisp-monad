# 3PRE — Shared prerequisites

## Spec
Browser-safe crypto, proof calldata, claim `#p=` codec, deployment parse, circuit public manifests.

## Changes
- `@noble/hashes` SHA-256; removed `node:crypto`/`Buffer` from client crypto paths
- `proofToSolidityCalldata` + Foundry fixture test
- `encodeClaimPayload` / `decodeClaimPayload` / `buildClaimUrl`; invites reuse
- `parseDeploymentManifest`
- Copied `artifacts-manifest.json` + `checksums.sha256` to `apps/web/public/circuits/`

## Test results
`pnpm --filter @wisp/crypto test` PASS; `pnpm --filter @wisp/shared test` PASS (Node 22).
