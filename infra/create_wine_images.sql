create table if not exists public.wine_images (
  id uuid default gen_random_uuid() primary key,
  tasting_note_id bigint references public.tasting_notes(id) on delete cascade not null,
  url text not null,
  thumbnail_url text,
  storage_path text,
  display_order int default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.wine_images enable row level security;

-- Data API exposure. RLS policies below still control row-level access.
grant usage on schema public to anon, authenticated, service_role;
revoke all privileges on table public.wine_images from anon, authenticated;
grant select on table public.wine_images to authenticated, service_role;
grant insert, update, delete on table public.wine_images to authenticated, service_role;
revoke all privileges on all sequences in schema public from anon, authenticated;
grant usage, select on all sequences in schema public to authenticated, service_role;

create policy "Users can select their own wine images" on public.wine_images for select using (
  auth.uid() = (
    select tasting_notes.user_id
    from public.tasting_notes
    where tasting_notes.id = wine_images.tasting_note_id
  )
);

create policy "Users can insert their own wine images" on public.wine_images for insert with check (
  auth.uid() = (
    select tasting_notes.user_id
    from public.tasting_notes
    where tasting_notes.id = wine_images.tasting_note_id
  )
);

create policy "Users can update their own wine images" on public.wine_images for update using (
  auth.uid() = (
    select tasting_notes.user_id
    from public.tasting_notes
    where tasting_notes.id = wine_images.tasting_note_id
  )
) with check (
  auth.uid() = (
    select tasting_notes.user_id
    from public.tasting_notes
    where tasting_notes.id = wine_images.tasting_note_id
  )
);

create policy "Users can delete their own wine images" on public.wine_images for delete using (
  auth.uid() = (
    select tasting_notes.user_id
    from public.tasting_notes
    where tasting_notes.id = wine_images.tasting_note_id
  )
);
