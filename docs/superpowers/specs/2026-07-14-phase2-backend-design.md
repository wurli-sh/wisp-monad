# Phase 2 Backend Design Spec

Prepared: 2026-07-14  
Binding rules: `impl-plan.md` §6  
Status: approved for implementation

## Goal

Provide durable identity resolution, encrypted-note delivery, Merkle path service, and Resend email invites while keeping on-chain authorization entirely in the contract.

## Locked decisions

- Serial Fastify tracks 2A–2F
- Resend (not SendGrid) for unregistered email claim links
- Google + email OTP auth first; X OAuth when developer app approved
- Upstash Redis for distributed rate limits (free tier)
- API-first exit gate (curl/scripts, not full Next.js UI)

## Architecture

- `apps/api` HTTP server (`src/server.ts`) + indexer (`src/indexer.ts`)
- One indexer holds a renewable Postgres lease that is rechecked on batch commit
- Zod schemas in `packages/shared`; crypto in `packages/crypto`
- Deployment manifest: `deployments/10143.json`
- Supabase Postgres + Auth; service role only in API env

## Pipeline tracks

| Track | Deliverable |
|---|---|
| 2A | Fastify scaffold, config, health/ready, Redis, logging, OpenAPI stub |
| 2B | Migrations, RLS, JWT auth, identity sync, wallet link, encryption helpers |
| 2C | resolve, notes, activity APIs |
| 2D | Merkle indexer, path API, admin reindex |
| 2E | Resend invites, ops runbook, container |
| 2F | Exit gate evidence |

## API surface

See Phase 2 plan for full route list.

## Data model

Tables per `impl-plan.md` §6.2: profiles, handles, wallets, wallet_link_nonces, encrypted_notes, pending_invites, activity, merkle_leaves, indexer_cursors.

## Out of scope

Phase 3 UI, browser proving, X OAuth (until app approved), mainnet.
