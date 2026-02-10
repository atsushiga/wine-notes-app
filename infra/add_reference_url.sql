-- Add reference_url column to tasting_notes table
alter table public.tasting_notes 
add column if not exists reference_url text;
