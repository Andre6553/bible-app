-- Run this in your Supabase SQL Editor
ALTER TABLE verses ADD COLUMN IF NOT EXISTS red_letters JSONB;

-- Comment describing the format
COMMENT ON COLUMN verses.red_letters IS 'Stores array of {start, end} indices for words spoken by Jesus/God for Red Letter display.';
