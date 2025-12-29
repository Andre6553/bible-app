
-- Add index to speed up fetching highlights by color
CREATE INDEX IF NOT EXISTS idx_highlights_user_color ON verse_highlights(user_id, color);
