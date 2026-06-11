-- Lock wine_images down to the owner of the parent tasting note.

revoke select on table public.wine_images from anon;

drop policy if exists "Enable read access for all users" on public.wine_images;
drop policy if exists "Enable insert for authenticated users only" on public.wine_images;
drop policy if exists "Enable update for authenticated users only" on public.wine_images;
drop policy if exists "Enable delete for authenticated users only" on public.wine_images;

drop policy if exists "Users can select their own wine images" on public.wine_images;
create policy "Users can select their own wine images"
  on public.wine_images for select
  using (
    auth.uid() = (
      select tasting_notes.user_id
      from public.tasting_notes
      where tasting_notes.id = wine_images.tasting_note_id
    )
  );

drop policy if exists "Users can insert their own wine images" on public.wine_images;
create policy "Users can insert their own wine images"
  on public.wine_images for insert
  with check (
    auth.uid() = (
      select tasting_notes.user_id
      from public.tasting_notes
      where tasting_notes.id = wine_images.tasting_note_id
    )
  );

drop policy if exists "Users can update their own wine images" on public.wine_images;
create policy "Users can update their own wine images"
  on public.wine_images for update
  using (
    auth.uid() = (
      select tasting_notes.user_id
      from public.tasting_notes
      where tasting_notes.id = wine_images.tasting_note_id
    )
  )
  with check (
    auth.uid() = (
      select tasting_notes.user_id
      from public.tasting_notes
      where tasting_notes.id = wine_images.tasting_note_id
    )
  );

drop policy if exists "Users can delete their own wine images" on public.wine_images;
create policy "Users can delete their own wine images"
  on public.wine_images for delete
  using (
    auth.uid() = (
      select tasting_notes.user_id
      from public.tasting_notes
      where tasting_notes.id = wine_images.tasting_note_id
    )
  );

notify pgrst, 'reload schema';
