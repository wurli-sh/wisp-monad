# Phase 3 Frontend Design Spec

Status: approved  
Date: 2026-07-14  
Overrides: `impl-plan.md` §7.2 visual system (palette + type). Product requirements in §7 remain binding.

## Goal

Ship a polished Monad web app that runs real protocol flows (send, claim, inbox, register, account) with hybrid Bullet structure + Wisp brand, verified X handles, and browser Groth16 proving.

## Approach

**Port Bullet IA and roundness; restyle with Wisp skin.** Scaffold Next.js in `apps/web`. Adapt Bullet page map, IslandNav, landing sections, and flow components. Replace Bullet ink/paper + lowercase + ink buttons with Wisp `#2F6FE3` palette, vitreous pill gradient, Framer Motion scale, and shimmer. Font: Onest everywhere. Wire to Phase 2 `/v1/*` + wagmi/viem. Close `provider_subject` for verified X.

## Design system

### Borrow from Bullet (`ref/frontend`)

- IslandNav (fixed centered pill, hide-on-scroll)
- Routes, page sections, landing layout/content order
- Roundness: `rounded-full` buttons/nav/inputs; `rounded-2xl` cards; `rounded-xl` secondary
- Brand assets: `wordmark.svg`, `logomark.svg`

### Borrow from Wisp (`../wisp/frontend`)

- Palette: brand `#2F6FE3` / dark `#255FD0` / soft `#E8F0FD`; bg `#F5F5F5`; card `#FAFAFA`; ink `#141414`; muted `#525252`; success/warn/danger from Wisp
- `.pill-gradient` vitreous overlay + `--shadow-blue-pill`
- Framer Motion button hover `1.05` / tap `0.97`
- Skeleton + text shimmer (`prefers-reduced-motion` safe)

### Avoid

- Bullet: all-lowercase marketing, lift animation, ink/paper/signal colors
- Wisp: `border-radius: 0`

### Type

[Onest](https://fonts.google.com/specimen/Onest) for UI and technical strings. Sentence / Title case copy.

## Routes

| Route | Purpose |
|-------|---------|
| `/` | Landing: hero + HeroSendBox + how-it-works + what-the-chain-sees |
| `/send` | Registered / unregistered send |
| `/register` | Google / X / email → wallet + inbox key |
| `/auth/callback` | Supabase OAuth allowlisted return |
| `/inbox` | Claimable / History / Sent |
| `/claim` | `#p=` fragment only (never `?p=`) |
| `/account` | Handles + Wallet |
| `/privacy` | Threat model + honest limits |

Landing hero: “Send money. Leave no trace.” + Google/X CTAs.

## Product flows

- **Wallet:** `viem/chains` `monadTestnet`; addresses from `deployments/10143.json`; exact ERC20 approve; simulate before write; MON + USDC gates.
- **Auth:** Bearer to API (`credentials: 'omit'`); wallet link via challenge + inbox-key signature.
- **Send:** resolve → approve → deposit → encrypt deliver; recovery `#p=` on delivery failure.
- **Claim:** Web Worker prove; checksum + `circuitId` gate; client-only hash parse.
- **X:** `provider_subject` immutable; no free-form handle claim.

## Shared prerequisites (P0)

Before prove/claim UI:

1. `proofToSolidityCalldata` in `@wisp/crypto`
2. Browser-safe crypto (no `node:crypto`/`Buffer` on client paths)
3. Shared `#p=` encode/decode in `@wisp/shared`
4. Browser-safe deployment parse
5. Circuit manifest + checksums under `apps/web/public/circuits/`

## Anti-patterns (do not port from Bullet)

- RSC `searchParams` / `?p=` claim links
- Freighter / Soroban / stroops / custody invite wallets
- Main-thread snarkjs
- Stellar / Freighter / stellar.expert copy

## Exit gate

Registered send+claim; verified X receive; unregistered X/email claim; honest failures; mobile-safe; live Monad explorer links; no `?p=` secrets; no prove assets on landing.
