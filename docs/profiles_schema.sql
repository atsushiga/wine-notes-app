-- profiles table (run in Supabase SQL Editor when using invite flow)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  onboarding_state text default 'pending',
  display_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS: select/update own profile only
alter table public.profiles enable row level security;

create policy "Users can select own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Optional: auto-create profile on signup (if not using invite; for invite, create in trigger or after invite)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, onboarding_state)
  values (new.id, 'pending')
  on conflict (id) do update set updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
