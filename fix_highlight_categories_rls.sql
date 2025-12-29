-- Enable Row Level Security (if not already enabled)
ALTER TABLE highlight_categories ENABLE ROW LEVEL SECURITY;

-- Drop previous restrictive policies if they exist
DROP POLICY IF EXISTS "Users can view their own highlight categories" ON highlight_categories;
DROP POLICY IF EXISTS "Users can insert their own highlight categories" ON highlight_categories;
DROP POLICY IF EXISTS "Users can update their own highlight categories" ON highlight_categories;
DROP POLICY IF EXISTS "Users can delete their own highlight categories" ON highlight_categories;

-- Create permissive policy for anonymous users (matches other tables like verse_highlights)
-- Ideally this should check if user_id matches the one in local storage, but for now we trust the client
-- to match the pattern of the other tables in this project.

CREATE POLICY "Allow all highlight_categories"
ON highlight_categories
FOR ALL
USING (true);
