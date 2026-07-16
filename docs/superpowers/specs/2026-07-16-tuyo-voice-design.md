# Wisp marketing voice — Tuyo-style (copy only)

**Date:** 2026-07-16  
**Status:** Approved for implementation planning  
**Scope:** Voice / copy only. No visual redesign, palette change, or layout restructuring.

## Intent

Rewrite product and marketing copy in the spirit of [Tuyo](https://tuyo.com/): benefit-first, imaginative, cheeky-simple. Lead with **pay a handle/email without hunting wallet addresses**. Season lightly with **privacy** (“quietly”, “privately”) — never lead with protocol jargon (USDC, Monad, ZK, on-chain unlinkability) on marketing or page chrome.

Technical honesty stays on `/privacy` body copy. Errors and toasts stay short and clear.

## Voice rules

1. **Simplicity first.** The promise is “pay an @handle or email — no wallet address hunt.”
2. **Privacy as seasoning.** Prefer “quietly” / “privately” / “private note” over mechanism.
3. **No protocol dump on chrome.** Ban from hero, subtitles, meta, How-it-works bodies: Circle USDC, Monad testnet, commitment, zero-knowledge, on-chain unlinkability.
4. **Tuyo rhythm.** Short outcome lines. Imagine the moment. One idea per sentence.
5. **Out of scope for rewrite:** visual layout, brand colors, toast/error strings (keep functional), circuit IDs in claim card note (keep as-is unless it becomes user-facing marketing).

## Copy map

### Landing hero (`apps/web/src/app/page.tsx`)

| Spot | Copy |
|------|------|
| Headline | Pay anyone by handle. Quietly. |
| Subhead | Type a handle or email. Hit pay. No wallet addresses exchanged. |
| CTA prompt | Getting paid? Open your private inbox. |

### Site meta (`apps/web/src/app/layout.tsx`)

| Spot | Copy |
|------|------|
| Title | Wisp — Pay any handle, privately |
| Description | Send money to an @handle or email. Simple, and private. |

### How it works (`apps/web/src/components/HowItWorks.tsx`)

Section heading: **How it works.**

| Step | Title | Body |
|------|-------|------|
| 01 | Type a handle. | `@patlu` or an email. That’s it — no wallet addresses to copy, paste, or mess up. |
| 02 | Pick an amount. Pay. | Choose a size, hit pay once. They get a private note waiting for them. |
| 03 | They claim when ready. | Your pay and their claim stay separate. No trail that ties you together. |

Demo card: label **Private note**, status **sent quietly** (replace “On-chain note” / “sent silently”).

### Send / Claim (`SendPageClient.tsx`, `SendForm.tsx`, `ClaimClient.tsx`)

| Spot | Copy |
|------|------|
| Send subtitle | Pay a handle or email. Quietly. |
| Claim subtitle | Open a link. Claim what’s waiting. |
| Send helper | Registered handle? Goes to their inbox. Otherwise you get a private claim link. |
| Claim empty | Drop a claim link here — or open one from your inbox. |
| Found status | Found {handle}. Delivering quietly to their inbox. |
| Unregistered title | They’re not on Wisp yet |
| Unregistered body | You’ll get a private claim link. Anyone with it can claim — treat it like cash. |

### Inbox (`InboxView.tsx`)

| Spot | Copy |
|------|------|
| Signed-out subtitle | Sign in to see what’s waiting. |
| Signed-in subtitle | Notes for you — claimable, claimed, and sent. |
| Unlock empty | Unlock once. Your notes stay private to you. |
| No claims | Nothing new. |
| No history | Nothing claimed yet. |
| No sent | Nothing sent yet. |

### Account (`AccountView.tsx`)

| Spot | Copy |
|------|------|
| Signed-out subtitle | Sign in to manage handles and wallet. |
| Signed-in subtitle | Your handles and linked wallet. |
| Handles blurb | Identities you’ve linked. X is verified — no free-form @handles. |

### Register (`RegisterFlow.tsx`)

| Spot | Copy |
|------|------|
| Create title / subtitle | Create your Wisp account / Continue with Google, X, or email. That’s your Wisp handle. |
| Link wallet | Link your wallet / One signature to link your wallet. We never hold your keys. |
| Done | You’re in. / Wallet and inbox are linked. |

### Privacy (`privacy/page.tsx`)

| Spot | Copy |
|------|------|
| Subtitle | What stays private — and what doesn’t. |
| Intro paragraph | Built for private payments. Here’s the straight story. Then keep existing honest testnet / mechanism limits (may lightly rephrase for readability; do not remove honesty). |

## Non-goals

- Regenerating `brand.md` palette or typography
- Landing layout / hero visual changes
- Rewriting toast error catalogue for playfulness
- Changing product behavior or API copy contracts

## Success check

A stranger reading only the landing hero understands: pay a person by handle/email, quietly — without needing to know Monad, USDC, or ZK.
