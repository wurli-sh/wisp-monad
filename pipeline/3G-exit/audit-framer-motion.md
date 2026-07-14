# Phase 3 audit patch — Framer Motion

## Issues found
1. Button used CSS scale instead of Framer Motion (broken `motion-dom` peer mismatch).
2. Claim checksums hardcoded instead of reading `artifacts-manifest.json`.
3. Landing / nav / tabs lacked shared motion language from Wisp.

## Patches
- Pin `framer-motion@12.40.0` + pnpm overrides `motion-dom@12.40.0`, `motion-utils@12.39.0`
- Shared tokens in `apps/web/src/lib/motion.ts` (`buttonHover` 1.05 / `buttonTap` 0.97)
- Motion on: Button, MotionLink, IslandNav, HeroSendBox, HomePage, Reveal, TextShimmer, Send denom pills, Account/Inbox tabs
- `verifyCircuitArtifacts()` loads hashes from `/circuits/artifacts-manifest.json`
- `prefers-reduced-motion` respected via `useReducedMotion()`

## Verify
- `pnpm --filter @wisp/web typecheck` / `build` PASS
