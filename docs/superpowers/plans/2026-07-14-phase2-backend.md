# Phase 2 Backend Implementation Plan

> **For agentic workers:** Implement tracks 2A→2F serially. Each track ends with pipeline test-results.

**Goal:** Ship Fastify API + indexer with Supabase, Resend, Upstash per `impl-plan.md` §6.

**Architecture:** Single `apps/api` package; shared Zod in `packages/shared`; Poseidon tree in `packages/crypto`.

**Tech Stack:** Fastify, Zod, Supabase JS, jose, viem, Upstash Redis, Resend, TweetNaCl, vitest.

---

## Track 2A: Scaffold

- [x] `apps/api` package with Fastify, config, Pino redaction, CORS
- [x] `/health`, `/ready` routes
- [x] Redis client + rate limiter interface
- [x] Deployment loader from `deployments/10143.json`
- [x] Root scripts: `dev:api`, `dev:indexer`, `test:api`
- [x] `pipeline/2A-scaffold/spec.md`

## Track 2B: Identity

- [x] Versioned Supabase migrations with RLS + atomic RPCs (live apply pending)
- [x] JWT auth middleware + identity sync
- [x] Wallet challenge/link + canonical signature
- [x] `DELETE /v1/handles/:id`
- [x] `packages/crypto` encryption + hashToField
- [x] `GET /v1/me`

## Track 2C: Delivery

- [x] `GET /v1/resolve`
- [x] `POST/GET /v1/notes`, claimed mark
- [x] `POST/GET /v1/activity`

## Track 2D: Indexer

- [x] Indexer poll Deposit/Claim events
- [x] `POST /v1/merkle/path`
- [x] `POST /v1/admin/reindex`

## Track 2E: Invites

- [x] `POST/GET /v1/invites` + Resend client
- [x] Dockerfile + ops runbook

## Track 2F: Exit

- [x] `scripts/e2e/phase2-api-smoke.sh`
- [x] Strict `scripts/e2e/phase2-testnet-preflight.sh`
- [ ] Live OAuth → wallet → deposit → ciphertext → restart → path exit evidence
