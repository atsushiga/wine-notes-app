create table if not exists public.wine_images (
  id uuid default gen_random_uuid() primary key,
  tasting_note_id bigint references public.tasting_notes(id) on delete cascade not null,
  url text not null,
  thumbnail_url text,
  storage_path text,
  display_order int default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS Policies (Assuming public read, authenticated insert/update/delete based on user_id check via tasting_note_id join or simpler open policy for now)
-- For now, enable RLS but allow public read/write if that matches existing pattern, or restrict. 
-- Existing pattern seems loose or relies on service role in API.
-- Let's just create the table first.

alter table public.wine_images enable row level security;

-- Data API exposure. RLS policies below still control row-level access.
grant usage on schema public to anon, authenticated, service_role;
revoke all privileges on table public.wine_images from anon, authenticated;
grant select on table public.wine_images to anon, authenticated, service_role;
grant insert, update, delete on table public.wine_images to authenticated, service_role;
revoke all privileges on all sequences in schema public from anon, authenticated;
grant usage, select on all sequences in schema public to authenticated, service_role;

create policy "Enable read access for all users" on public.wine_images for select using (true);
create policy "Enable insert for authenticated users only" on public.wine_images for insert with check (auth.role() = 'authenticated' OR auth.role() = 'service_role');
create policy "Enable update for authenticated users only" on public.wine_images for update using (auth.role() = 'authenticated' OR auth.role() = 'service_role');
create policy "Enable delete for authenticated users only" on public.wine_images for delete using (auth.role() = 'authenticated' OR auth.role() = 'service_role');
