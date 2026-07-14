# Phase 3 Frontend — Bite-Sized Implementation Plan

> Implements `docs/superpowers/specs/2026-07-14-phase3-frontend-design.md` and Cursor plan Phase 3 Frontend.
> Tracks: **3PRE → 3A → 3B → 3C → 3D → 3E → 3F → 3G**.

**Goal:** Real protocol UI on Monad with Bullet IA + Wisp skin + Onest.

**Stack:** Next.js 15, Tailwind v4, Framer Motion, wagmi/viem, Supabase SSR, snarkjs worker, `@wisp/crypto`, `@wisp/shared`.

---

## Track 3PRE — Shared prerequisites

### Task PRE.1: Browser-safe SHA-256 helpers
- Add `@noble/hashes`; replace `node:crypto`/`Buffer` in `encryption.ts` + `signature.ts`.
- Tests still pass.

### Task PRE.2: `proofToSolidityCalldata`
- Create `packages/crypto/src/proof.ts` matching Foundry fixture G2 swap order.
- Test against `contracts/test/fixtures/real_proof_10143.json` shape from a known snarkjs proof or pure transform test.
- Export from `index.ts`.

### Task PRE.3: Claim payload `#p=` codec
- `packages/shared/src/claim-link.ts`: `encodeClaimPayload` / `decodeClaimPayload` via base64url + `claimPayloadV1Schema`.
- Reuse in `apps/api/src/routes/invites.ts`.

### Task PRE.4: `parseDeploymentManifest`
- Browser-safe parse of unknown JSON via existing `deploymentSchema`.
- Keep Node `loadDeploymentManifest` as fs wrapper.

### Task PRE.5: Circuit public assets
- Copy `artifacts-manifest.json` + `checksums.sha256` into `apps/web/public/circuits/`.

---

## Track 3A — Next.js scaffold + design system

- Real `apps/web` Next 15 app; Onest; Wisp `@theme` without radius-zero; Bullet roundness.
- `Button`, shimmer, `IslandNav`, layout, landing stubs, `lib/api.ts` bearer omit cookies.
- Wordmark assets.

## Track 3B — Auth + X

- Apply migrations if needed; `provider_subject` migration; update `syncIdentity`.
- Supabase SSR, `/auth/callback`, `/register`, `/account` handles (no free-form X claim).

## Track 3C — Wallet

- wagmi/`monadTestnet`; deployment import; exact approve; gas/MON/USDC gates; wallet link UI.

## Track 3D — Send

- Send state machine; HeroSendBox; recovery `#p=`; invites.

## Track 3E — Prove + claim

- Worker; checksum verify; `#p=` client claim; reject `?p=`.

## Track 3F — Inbox + privacy

- Decrypt tabs; privacy page.

## Track 3G — Exit

- CSP, tests, smoke, pipeline folders, Vercel notes.

---

## Exit gate

Same as design spec / Cursor plan.
