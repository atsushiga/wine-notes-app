-- 1. Add new SAT columns
ALTER TABLE tasting_notes 
  ADD COLUMN IF NOT EXISTS sat_appearance_intensity text,
  ADD COLUMN IF NOT EXISTS sat_nose_intensity text,
  ADD COLUMN IF NOT EXISTS sat_development text,
  ADD COLUMN IF NOT EXISTS sat_sweetness text,
  ADD COLUMN IF NOT EXISTS sat_acidity text,
  ADD COLUMN IF NOT EXISTS sat_tannin text,
  ADD COLUMN IF NOT EXISTS sat_alcohol text,
  ADD COLUMN IF NOT EXISTS sat_body text,
  ADD COLUMN IF NOT EXISTS sat_finish text,
  ADD COLUMN IF NOT EXISTS sat_quality text;

-- 2. Convert 'aromas' from TEXT to TEXT[]
-- Using string_to_array to split the comma-separated string.
-- Assuming the separator is ", " based on the CSV data.
-- If 'aromas' is already TEXT[], this block will error unless we use a DO block or careful checks, 
-- but standard ALTER COLUMN TYPE with USING is usually safe if types match or convertable.
-- However, since 'IF NOT EXISTS' isn't available for ALTER COLUMN properly in pure SQL without PL/pgSQL usually:

DO $$
BEGIN
    -- Check if aromas is not an array (i.e. it is text)
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'tasting_notes' 
        AND column_name = 'aromas' 
        AND data_type = 'text'
    ) THEN
        -- Convert to array
        -- Note: We split by ', ' (comma + space) which seems to be the format.
        -- If format varies, regex_split_to_array might be safer, e.g. E',\\s*'
        ALTER TABLE tasting_notes 
          ALTER COLUMN aromas TYPE text[] 
          USING string_to_array(aromas, ', ');
    END IF;
END $$;
