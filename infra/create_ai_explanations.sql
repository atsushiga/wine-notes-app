create extension if not exists pgcrypto;

create table if not exists public.ai_explanations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  client_key text,
  source_tasting_note_id bigint references public.tasting_notes(id) on delete set null,
  generated_at timestamptz not null default now(),
  input jsonb not null default '{}'::jsonb,
  explanation jsonb not null,
  image_url text,
  wine_name text,
  producer text,
  vintage text,
  country text,
  locality text,
  headline text,
  price integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_explanations_owner_check check (user_id is not null or client_key is not null)
);

alter table public.ai_explanations
  add column if not exists price integer;

update public.ai_explanations
set price = coalesce(
  nullif(regexp_replace(coalesce(input->>'price', ''), '\D', '', 'g'), '')::integer,
  case
    when explanation #>> '{wine,marketPriceJpy}' ~ '^\d+$'
      then (explanation #>> '{wine,marketPriceJpy}')::integer
    else null
  end
)
where price is null
  and (
    nullif(regexp_replace(coalesce(input->>'price', ''), '\D', '', 'g'), '') is not null
    or explanation #>> '{wine,marketPriceJpy}' ~ '^\d+$'
  );

create index if not exists ai_explanations_user_generated_at_idx
  on public.ai_explanations(user_id, generated_at desc);

create index if not exists ai_explanations_client_generated_at_idx
  on public.ai_explanations(client_key, generated_at desc);

create index if not exists ai_explanations_source_tasting_note_id_idx
  on public.ai_explanations(source_tasting_note_id);

alter table public.tasting_notes
  add column if not exists ai_explanation_id uuid references public.ai_explanations(id) on delete set null;

create index if not exists tasting_notes_ai_explanation_id_idx
  on public.tasting_notes(ai_explanation_id);

alter table public.ai_explanations enable row level security;

drop policy if exists "Users can read own AI explanations" on public.ai_explanations;
create policy "Users can read own AI explanations"
  on public.ai_explanations for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own AI explanations" on public.ai_explanations;
create policy "Users can insert own AI explanations"
  on public.ai_explanations for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own AI explanations" on public.ai_explanations;
create policy "Users can update own AI explanations"
  on public.ai_explanations for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own AI explanations" on public.ai_explanations;
create policy "Users can delete own AI explanations"
  on public.ai_explanations for delete
  using (auth.uid() = user_id);

notify pgrst, 'reload schema';
