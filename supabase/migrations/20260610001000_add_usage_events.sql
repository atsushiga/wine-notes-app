create extension if not exists pgcrypto;

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  subject_key text,
  action text not null,
  quantity integer not null default 1 check (quantity > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint usage_events_owner_check check (user_id is not null or subject_key is not null)
);

create index if not exists usage_events_user_action_created_at_idx
  on public.usage_events(user_id, action, created_at desc)
  where user_id is not null;

create index if not exists usage_events_subject_action_created_at_idx
  on public.usage_events(subject_key, action, created_at desc)
  where subject_key is not null;

alter table public.usage_events enable row level security;

grant usage on schema public to anon, authenticated, service_role;
revoke all privileges on table public.usage_events from anon, authenticated;
grant select on table public.usage_events to authenticated, service_role;
grant insert, delete on table public.usage_events to service_role;

drop policy if exists "Users can select own usage events" on public.usage_events;
create policy "Users can select own usage events"
  on public.usage_events for select
  using (auth.uid() = user_id);

notify pgrst, 'reload schema';
