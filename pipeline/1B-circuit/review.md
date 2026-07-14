# 1B review

- Public signal order locked and tested
- Single-team setup; canonical zkey rotated with fresh OS randomness on
  2026-07-14; intermediate toxic waste deleted/gitignored
- Normal builds reuse and validate the canonical zkey and fail if the R1CS hash
  changes; setup rotation requires explicit `GENERATE_ZKEY=1`
- Powers-of-Tau BLAKE2b checksum is pinned before rotation
- Browser prove estimate from Node prove time (~0.8s) is well under 30s mid-range target
- Continue to 1C (done in same session for pool + real proof)
