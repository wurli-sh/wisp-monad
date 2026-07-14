-- Wisp Phase 2 schema (impl-plan §6.2)

create extension if not exists "pgcrypto";

-- profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- handles
create type public.handle_provider as enum ('google', 'x', 'email');

create table if not exists public.handles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider public.handle_provider not null,
  normalized text not null,
  display text not null,
  verified_at timestamptz not null default now(),
  constraint handles_provider_normalized_unique unique (provider, normalized)
);

create index if not exists handles_user_id_idx on public.handles(user_id);

-- wallets
create table if not exists public.wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  chain_id integer not null,
  address text not null,
  inbox_pubkey text not null check (length(inbox_pubkey) = 66),
  link_signature_hash text not null,
  linked_at timestamptz not null default now(),
  constraint wallets_chain_address_unique unique (chain_id, address)
);

-- wallet link nonces
create table if not exists public.wallet_link_nonces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  nonce_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz
);

-- encrypted notes (no commitment column)
create table if not exists public.encrypted_notes (
  id uuid primary key default gen_random_uuid(),
  recipient_pubkey text not null check (length(recipient_pubkey) = 66),
  ephemeral_pubkey text not null check (length(ephemeral_pubkey) = 66),
  nonce text not null check (length(nonce) = 50),
  ciphertext text not null check (length(ciphertext) <= 131072),
  envelope_hash text not null unique,
  created_at timestamptz not null default now(),
  claimed_at timestamptz
);

-- pending invites
create type public.delivery_kind as enum ('x_copy', 'email');

create table if not exists public.pending_invites (
  id uuid primary key default gen_random_uuid(),
  sender_user_id uuid not null references public.profiles(id) on delete cascade,
  normalized_handle text not null,
  delivery_kind public.delivery_kind not null,
  encrypted_payload text not null,
  encrypted_nullifier text,
  nullifier_lookup_tag text,
  crypto_key_version integer not null default 1,
  deposit_chain_id integer,
  deposit_pool text,
  deposit_tx_hash text,
  deposit_log_index integer,
  expires_at timestamptz,
  delivered_at timestamptz,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint pending_invites_deposit_idempotency unique (
    deposit_chain_id, deposit_pool, deposit_tx_hash, deposit_log_index
  )
);

create index if not exists pending_invites_sender_idx
  on public.pending_invites(sender_user_id);

-- activity (owner-only ciphertext)
create table if not exists public.activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  ephemeral_pubkey text not null check (length(ephemeral_pubkey) = 66),
  nonce text not null check (length(nonce) = 50),
  ciphertext text not null check (length(ciphertext) <= 131072),
  envelope_hash text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists activity_user_id_idx on public.activity(user_id);

-- merkle indexer
create table if not exists public.merkle_leaves (
  chain_id integer not null,
  pool text not null,
  leaf_index integer not null,
  commitment text not null,
  root text not null,
  block_number bigint not null,
  block_hash text not null,
  tx_hash text not null,
  log_index integer not null,
  primary key (chain_id, pool, leaf_index),
  constraint merkle_leaves_pool_commitment_unique unique (chain_id, pool, commitment),
  constraint merkle_leaves_tx_log_unique unique (chain_id, tx_hash, log_index)
);

create table if not exists public.indexer_cursors (
  chain_id integer not null,
  pool text not null,
  next_block bigint not null,
  last_finalized_hash text,
  last_root text,
  updated_at timestamptz not null default now(),
  primary key (chain_id, pool)
);

-- RLS: deny direct browser access; API uses service role
alter table public.profiles enable row level security;
alter table public.handles enable row level security;
alter table public.wallets enable row level security;
alter table public.wallet_link_nonces enable row level security;
alter table public.encrypted_notes enable row level security;
alter table public.pending_invites enable row level security;
alter table public.activity enable row level security;
alter table public.merkle_leaves enable row level security;
alter table public.indexer_cursors enable row level security;

-- Explicit revoke for anon/authenticated on sensitive tables
revoke all on public.profiles from anon, authenticated;
revoke all on public.handles from anon, authenticated;
revoke all on public.wallets from anon, authenticated;
revoke all on public.wallet_link_nonces from anon, authenticated;
revoke all on public.encrypted_notes from anon, authenticated;
revoke all on public.pending_invites from anon, authenticated;
revoke all on public.activity from anon, authenticated;
revoke all on public.merkle_leaves from anon, authenticated;
revoke all on public.indexer_cursors from anon, authenticated;

grant usage on schema public to anon, authenticated;
grant select on public.merkle_leaves to service_role;
grant all on all tables in schema public to service_role;

create or replace function public.wisp_try_indexer_lock(lock_key bigint)
returns boolean
language sql
security definer
as $$
  select pg_try_advisory_lock(lock_key);
$$;

create or replace function public.wisp_release_indexer_lock(lock_key bigint)
returns boolean
language sql
security definer
as $$
  select pg_advisory_unlock(lock_key);
$$;

grant execute on function public.wisp_try_indexer_lock(bigint) to service_role;
grant execute on function public.wisp_release_indexer_lock(bigint) to service_role;
