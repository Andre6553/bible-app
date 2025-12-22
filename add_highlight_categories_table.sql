-- Run this in your Supabase SQL Editor
CREATE TABLE IF NOT EXISTS highlight_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    color TEXT NOT NULL,
    label TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, color)
);

-- Index for fast lookup by user
CREATE INDEX IF NOT EXISTS idx_highlight_categories_user ON highlight_categories(user_id);

COMMENT ON TABLE highlight_categories IS 'User-defined labels for highlight colors (e.g., Yellow = Faith).';
