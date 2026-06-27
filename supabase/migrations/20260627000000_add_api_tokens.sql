create extension if not exists pgcrypto;

create table if not exists public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  token_id text not null unique,
  token_hash text not null,
  token_prefix text not null,
  scopes text[] not null default array['notes:read']::text[],
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint api_tokens_name_length check (char_length(trim(name)) between 1 and 80),
  constraint api_tokens_scope_allowlist check (
    cardinality(scopes) > 0
    and scopes <@ array['notes:read', 'images:read']::text[]
  )
);

create index if not exists api_tokens_user_created_at_idx
  on public.api_tokens(user_id, created_at desc);

create index if not exists api_tokens_token_id_active_idx
  on public.api_tokens(token_id)
  where revoked_at is null;

alter table public.api_tokens enable row level security;

grant usage on schema public to anon, authenticated, service_role;
revoke all privileges on table public.api_tokens from anon, authenticated;
grant all on table public.api_tokens to service_role;

drop policy if exists "Users can select own API tokens" on public.api_tokens;
create policy "Users can select own API tokens"
  on public.api_tokens for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own API tokens" on public.api_tokens;
create policy "Users can insert own API tokens"
  on public.api_tokens for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own API tokens" on public.api_tokens;
create policy "Users can update own API tokens"
  on public.api_tokens for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

alter table public.tasting_notes
  add column if not exists updated_at timestamptz not null default now();

alter table public.wine_images
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists set_tasting_notes_updated_at on public.tasting_notes;
create trigger set_tasting_notes_updated_at
  before update on public.tasting_notes
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_wine_images_updated_at on public.wine_images;
create trigger set_wine_images_updated_at
  before update on public.wine_images
  for each row
  execute function public.set_updated_at();

notify pgrst, 'reload schema';
