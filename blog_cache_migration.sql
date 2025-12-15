-- Blog Content Caching Migration
-- Run this in Supabase SQL Editor

-- Add recommended_articles column to store cached article content as JSON
-- Add last_refresh timestamp to track when content was last generated
ALTER TABLE user_devotionals 
ADD COLUMN IF NOT EXISTS recommended_articles JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS last_refresh TIMESTAMPTZ DEFAULT NOW();

-- Update existing rows to have a last_refresh timestamp
UPDATE user_devotionals 
SET last_refresh = created_at 
WHERE last_refresh IS NULL;
