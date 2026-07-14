#!/usr/bin/env bash
# Deterministic circuit compilation with an explicit, randomized setup rotation mode.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD="$ROOT/build/claim"
ART="$ROOT/artifacts/claim"
POT="$ROOT/pot"
WEB_PUB="$ROOT/../apps/web/public/circuits"
CONTRACT_VERIFIER="$ROOT/../contracts/src/generated/Groth16Verifier.sol"
CEILING=25000
PTAU_B2="982372c867d229c236091f767e703253249a9b432c1710b4f326306bfa2428a17b06240359606cfe4d580b10a5a1f63fbed499527069c18ae17060472969ae6e"
mkdir -p "$BUILD" "$ART" "$POT"
umask 077

cleanup() {
  rm -f "$BUILD/claim_0000.zkey" "$BUILD/claim_rotated.zkey"
  unset CONTRIBUTION_ENTROPY
}
trap cleanup EXIT

cd "$ROOT"
echo "==> Compiling claim.circom"
circom src/claim.circom --r1cs --wasm --sym --prime bn128 -o "$BUILD"

CONSTRAINTS=$(pnpm exec snarkjs r1cs info "$BUILD/claim.r1cs" 2>&1 | awk '
  match($0, /Constraints: [0-9]+/) {
    value = substr($0, RSTART, RLENGTH);
    sub(/Constraints: /, "", value);
    print value;
    exit;
  }
')
echo "Constraints: ${CONSTRAINTS:-unknown}"
if [[ -z "${CONSTRAINTS}" ]]; then
  echo "FAIL: could not read the constraint count" >&2
  exit 1
fi
if [[ "${CONSTRAINTS}" -gt "${CEILING}" ]]; then
  echo "FAIL: constraints ${CONSTRAINTS} > ceiling ${CEILING}" >&2
  exit 1
fi

cp "$BUILD/claim_js/claim.wasm" "$ART/claim.wasm"
cp "$BUILD/claim.r1cs" "$ART/claim.r1cs"

if [[ "${GENERATE_ZKEY:-0}" != "1" ]]; then
  if [[ ! -f "$ART/claim_final.zkey" || ! -f "$ART/artifacts-manifest.json" ]]; then
    echo "FAIL: canonical zkey/manifest missing; run GENERATE_ZKEY=1 pnpm build:circuits" >&2
    exit 1
  fi
  EXPECTED_R1CS=$(node -e 'const m=require(process.argv[1]); process.stdout.write(m.artifacts.r1cs || "")' "$ART/artifacts-manifest.json")
  ACTUAL_R1CS=$(sha256sum "$ART/claim.r1cs" | awk '{print $1}')
  if [[ -z "$EXPECTED_R1CS" || "$EXPECTED_R1CS" != "$ACTUAL_R1CS" ]]; then
    echo "FAIL: circuit changed; an explicit randomized zkey rotation is required" >&2
    echo "Run: GENERATE_ZKEY=1 pnpm build:circuits" >&2
    exit 1
  fi
else
  # This mode intentionally changes the verifier and every proof fixture.
  # At least one contribution uses fresh OS randomness and is never printed.
  PTAU="$POT/powersOfTau28_hez_final_15.ptau"
  if [[ ! -f "$PTAU" ]]; then
    echo "Downloading pinned Powers of Tau pot15..."
    curl --fail --location --output "$PTAU.tmp" \
      https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_15.ptau
    mv "$PTAU.tmp" "$PTAU"
  fi
  printf '%s  %s\n' "$PTAU_B2" "$PTAU" | b2sum --check --status

  echo "==> Rotating Groth16 setup"
  pnpm exec snarkjs groth16 setup "$BUILD/claim.r1cs" "$PTAU" "$BUILD/claim_0000.zkey"
  CONTRIBUTION_ENTROPY=$(node -e 'process.stdout.write(require("node:crypto").randomBytes(64).toString("hex"))')
  pnpm exec snarkjs zkey contribute "$BUILD/claim_0000.zkey" "$BUILD/claim_rotated.zkey" \
    --name="wisp-claim-hackathon" --entropy="$CONTRIBUTION_ENTROPY"
  unset CONTRIBUTION_ENTROPY
  mv "$BUILD/claim_rotated.zkey" "$ART/claim_final.zkey"
fi

pnpm exec snarkjs zkey export verificationkey "$ART/claim_final.zkey" "$ART/verification_key.json"
pnpm exec snarkjs zkey export solidityverifier "$ART/claim_final.zkey" "$ART/Groth16Verifier.sol"

# Web public assets copy target
mkdir -p "$WEB_PUB"
cp "$ART/claim.wasm" "$WEB_PUB/claim.wasm"
cp "$ART/claim_final.zkey" "$WEB_PUB/claim_final.zkey"
cp "$ART/Groth16Verifier.sol" "$CONTRACT_VERIFIER"

if [[ "${GENERATE_ZKEY:-0}" == "1" ]]; then
  node "$ROOT/scripts/gen-claim-fixture.mjs"
fi

node "$ROOT/scripts/write-manifest.mjs" "$CONSTRAINTS"
( cd "$ART" && sha256sum claim.r1cs claim.wasm claim_final.zkey verification_key.json Groth16Verifier.sol > checksums.sha256 )

echo "Claim artifacts at $ART"
