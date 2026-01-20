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

create policy "Enable read access for all users" on public.wine_images for select using (true);
create policy "Enable insert for authenticated users only" on public.wine_images for insert with check (auth.role() = 'authenticated' OR auth.role() = 'service_role');
create policy "Enable update for authenticated users only" on public.wine_images for update using (auth.role() = 'authenticated' OR auth.role() = 'service_role');
create policy "Enable delete for authenticated users only" on public.wine_images for delete using (auth.role() = 'authenticated' OR auth.role() = 'service_role');
