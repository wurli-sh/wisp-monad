-- Phase 3: immutable provider subject for verified X handles (impl-plan §7.5.1)

alter table public.handles
  add column if not exists provider_subject text;

-- Backfill email/google subjects from normalized for existing rows (best-effort)
update public.handles
set provider_subject = normalized
where provider_subject is null
  and provider in ('email', 'google');

-- X rows without subject stay null until next OAuth sync; unique allows multiple NULLs in Postgres
create unique index if not exists handles_provider_subject_unique
  on public.handles (provider, provider_subject)
  where provider_subject is not null;

create or replace function public.wisp_keep_provider_subject_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.provider_subject is not null
     and new.provider_subject is distinct from old.provider_subject then
    raise exception 'provider_subject is immutable' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists handles_provider_subject_immutable on public.handles;
create trigger handles_provider_subject_immutable
before update of provider_subject on public.handles
for each row execute function public.wisp_keep_provider_subject_immutable();
