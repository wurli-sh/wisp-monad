# Brand — Wisp

Wisp is a private payments experience: pay any @handle or email, quietly. Visual language stays composed and dependable; marketing voice is Tuyo-style — simple, cheeky, benefit-first, with privacy as seasoning (see `docs/superpowers/specs/2026-07-16-tuyo-voice-design.md`).

## Palette: Restrained Cobalt

- **Action cobalt:** `#2C5CC5`; use only for primary actions, inline action links, and focus.
- **Action hover:** `#244CA6`; use only as the primary-action hover state.
- **Ink:** `#171A20`; use for navigation, selected choices, and high-emphasis neutral controls.
- **Cool canvas:** `#F6F7F9`; **surface:** `#FFFFFF`; **muted surface:** `#EEF1F5`.
- **Selection:** `#E5E9EF` with `#1B1E25` text; selected tabs and filters must not use cobalt.
- **Feedback:** success `#14785F`, warning `#A76616`, destructive `#B93834`.

## Voice

- Lead with simplicity: pay a handle/email — no wallet address hunt.
- Hint privacy with “quietly” / “privately”; never dump USDC / Monad / ZK jargon on page chrome.
- Keep `/privacy` body honest and technical.

## Usage rules

- One cobalt primary action per decision area. Do not use cobalt for tabs, active navigation, table headers, cards, or routine decoration.
- Keep the island nav ink-based; its active item uses `nav-active`, not cobalt.
- Use action-soft (`brand-soft` / `brand-mist`) only as a quiet support surface. Use neutral surfaces for data-heavy UI.
- The Wisp Visa/note card is the only persistent cobalt-to-ink gradient surface.
- Use the shared semantic color tokens from `apps/web/src/app/globals.css`; do not introduce literal component colors.
