alter table public.profiles
  add column if not exists simple_auto_image_optimize boolean not null default true,
  add column if not exists simple_auto_wine_name_search boolean not null default true,
  add column if not exists simple_auto_ai_info boolean not null default true;

update public.profiles
set
  simple_auto_image_optimize = coalesce(simple_auto_image_optimize, true),
  simple_auto_wine_name_search = coalesce(simple_auto_wine_name_search, true),
  simple_auto_ai_info = coalesce(simple_auto_ai_info, true);

update public.profiles
set simple_auto_ai_info = false
where simple_auto_wine_name_search = false;

alter table public.profiles
  drop constraint if exists profiles_simple_ai_info_requires_wine_name_search;

alter table public.profiles
  add constraint profiles_simple_ai_info_requires_wine_name_search
  check (simple_auto_wine_name_search or not simple_auto_ai_info);

notify pgrst, 'reload schema';
