-- profiles table (run in Supabase SQL Editor when using invite flow)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  onboarding_state text default 'pending',
  default_input_mode text not null default 'simple' check (default_input_mode in ('simple', 'detailed')),
  display_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS: select/update own profile only
alter table public.profiles enable row level security;

-- Data API exposure. RLS policies below still limit rows to the current user.
grant usage on schema public to anon, authenticated, service_role;
revoke all privileges on table public.profiles from anon, authenticated;
grant select, insert, update on table public.profiles to authenticated, service_role;

create policy "Users can select own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Optional: auto-create profile on signup (if not using invite; for invite, create in trigger or after invite)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, onboarding_state)
  values (new.id, 'pending')
  on conflict (id) do update set updated_at = now();
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon, authenticated;
