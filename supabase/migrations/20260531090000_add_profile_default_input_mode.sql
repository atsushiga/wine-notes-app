alter table public.profiles
  add column if not exists default_input_mode text not null default 'simple';

alter table public.profiles
  drop constraint if exists profiles_default_input_mode_check;

alter table public.profiles
  add constraint profiles_default_input_mode_check
  check (default_input_mode in ('simple', 'detailed'));

update public.profiles
set default_input_mode = 'simple'
where default_input_mode is null;

grant insert on table public.profiles to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Users can insert own profile'
  ) then
    create policy "Users can insert own profile"
      on public.profiles for insert
      with check (auth.uid() = id);
  end if;
end $$;

notify pgrst, 'reload schema';
