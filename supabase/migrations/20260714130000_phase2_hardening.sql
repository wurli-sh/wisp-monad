-- Phase 2 audit hardening: atomic wallet linking and durable indexer leases/batches.

alter table public.handles
  add column if not exists is_active boolean not null default true;

alter table public.wallet_link_nonces
  add column if not exists challenge_hash text;

alter table public.pending_invites
  add column if not exists provider_message_id text,
  add column if not exists delivery_error text;

alter table public.encrypted_notes
  drop constraint if exists encrypted_notes_ciphertext_check;
alter table public.encrypted_notes
  add constraint encrypted_notes_ciphertext_check
  check (length(ciphertext) <= 131074);

alter table public.activity
  drop constraint if exists activity_ciphertext_check;
alter table public.activity
  add constraint activity_ciphertext_check
  check (length(ciphertext) <= 131074);

create table if not exists public.indexer_leases (
  id smallint primary key check (id = 1),
  holder_id uuid not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.indexer_leases enable row level security;
revoke all on public.indexer_leases from public, anon, authenticated;
grant all on public.indexer_leases to service_role;

drop function if exists public.wisp_try_indexer_lock(bigint);
drop function if exists public.wisp_release_indexer_lock(bigint);

create or replace function public.wisp_link_wallet(
  p_user_id uuid,
  p_nonce_hash text,
  p_challenge_hash text,
  p_chain_id integer,
  p_address text,
  p_inbox_pubkey text,
  p_link_signature_hash text
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  consumed_id uuid;
begin
  update public.wallet_link_nonces
     set consumed_at = now()
   where user_id = p_user_id
     and nonce_hash = p_nonce_hash
     and challenge_hash = p_challenge_hash
     and consumed_at is null
     and expires_at > now()
  returning id into consumed_id;

  if consumed_id is null then
    return false;
  end if;

  insert into public.wallets (
    user_id, chain_id, address, inbox_pubkey, link_signature_hash, linked_at
  ) values (
    p_user_id, p_chain_id, lower(p_address), lower(p_inbox_pubkey),
    p_link_signature_hash, now()
  )
  on conflict (user_id) do update set
    chain_id = excluded.chain_id,
    address = excluded.address,
    inbox_pubkey = excluded.inbox_pubkey,
    link_signature_hash = excluded.link_signature_hash,
    linked_at = excluded.linked_at;

  return true;
end;
$$;

create or replace function public.wisp_acquire_indexer_lease(
  p_holder_id uuid,
  p_ttl_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  acquired uuid;
begin
  if p_ttl_seconds < 10 or p_ttl_seconds > 300 then
    raise exception 'invalid lease ttl';
  end if;

  insert into public.indexer_leases (id, holder_id, expires_at, updated_at)
  values (1, p_holder_id, now() + make_interval(secs => p_ttl_seconds), now())
  on conflict (id) do update set
    holder_id = excluded.holder_id,
    expires_at = excluded.expires_at,
    updated_at = excluded.updated_at
  where public.indexer_leases.expires_at <= now()
     or public.indexer_leases.holder_id = p_holder_id
  returning holder_id into acquired;

  return acquired = p_holder_id;
end;
$$;

create or replace function public.wisp_release_indexer_lease(p_holder_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.indexer_leases
     set expires_at = now(), updated_at = now()
   where id = 1 and holder_id = p_holder_id;
  return found;
end;
$$;

create or replace function public.wisp_reset_indexer_pool(
  p_chain_id integer,
  p_pool text,
  p_deployment_block bigint
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.pending_invites
     set claimed_at = null
   where deposit_chain_id = p_chain_id and deposit_pool = lower(p_pool);

  delete from public.merkle_leaves
   where chain_id = p_chain_id and pool = lower(p_pool);

  insert into public.indexer_cursors (
    chain_id, pool, next_block, last_finalized_hash, last_root, updated_at
  ) values (
    p_chain_id, lower(p_pool), p_deployment_block, null, null, now()
  )
  on conflict (chain_id, pool) do update set
    next_block = excluded.next_block,
    last_finalized_hash = null,
    last_root = null,
    updated_at = now();
end;
$$;

create or replace function public.wisp_apply_indexer_batch(
  p_chain_id integer,
  p_pool text,
  p_holder_id uuid,
  p_expected_next_block bigint,
  p_next_block bigint,
  p_last_finalized_hash text,
  p_last_root text,
  p_deposits jsonb,
  p_claim_tags text[]
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_next bigint;
  item jsonb;
begin
  if not exists (
    select 1 from public.indexer_leases
     where id = 1 and holder_id = p_holder_id and expires_at > now()
  ) then
    return false;
  end if;

  select next_block into current_next
    from public.indexer_cursors
   where chain_id = p_chain_id and pool = lower(p_pool)
   for update;

  if current_next is null or current_next <> p_expected_next_block then
    return false;
  end if;

  for item in select value from jsonb_array_elements(coalesce(p_deposits, '[]'::jsonb)) loop
    insert into public.merkle_leaves (
      chain_id, pool, leaf_index, commitment, root, block_number,
      block_hash, tx_hash, log_index
    ) values (
      p_chain_id,
      lower(p_pool),
      (item->>'leafIndex')::integer,
      lower(item->>'commitment'),
      lower(item->>'root'),
      (item->>'blockNumber')::bigint,
      lower(item->>'blockHash'),
      lower(item->>'txHash'),
      (item->>'logIndex')::integer
    );
  end loop;

  if coalesce(array_length(p_claim_tags, 1), 0) > 0 then
    update public.pending_invites
       set claimed_at = coalesce(claimed_at, now())
     where nullifier_lookup_tag = any(p_claim_tags);
  end if;

  update public.indexer_cursors set
    next_block = p_next_block,
    last_finalized_hash = lower(p_last_finalized_hash),
    last_root = lower(p_last_root),
    updated_at = now()
  where chain_id = p_chain_id and pool = lower(p_pool);

  return true;
end;
$$;

revoke all on function public.wisp_link_wallet(uuid,text,text,integer,text,text,text)
  from public, anon, authenticated;
revoke all on function public.wisp_acquire_indexer_lease(uuid,integer)
  from public, anon, authenticated;
revoke all on function public.wisp_release_indexer_lease(uuid)
  from public, anon, authenticated;
revoke all on function public.wisp_reset_indexer_pool(integer,text,bigint)
  from public, anon, authenticated;
revoke all on function public.wisp_apply_indexer_batch(integer,text,uuid,bigint,bigint,text,text,jsonb,text[])
  from public, anon, authenticated;

grant execute on function public.wisp_link_wallet(uuid,text,text,integer,text,text,text)
  to service_role;
grant execute on function public.wisp_acquire_indexer_lease(uuid,integer)
  to service_role;
grant execute on function public.wisp_release_indexer_lease(uuid)
  to service_role;
grant execute on function public.wisp_reset_indexer_pool(integer,text,bigint)
  to service_role;
grant execute on function public.wisp_apply_indexer_batch(integer,text,uuid,bigint,bigint,text,text,jsonb,text[])
  to service_role;
