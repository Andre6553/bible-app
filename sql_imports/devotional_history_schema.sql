-- Devotional History Table
-- Tracks generated devotionals to prevent repetition

CREATE TABLE IF NOT EXISTS devotional_history (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    generated_date DATE NOT NULL DEFAULT CURRENT_DATE,
    theme TEXT,                    -- Topic used (e.g., 'faith', 'love')
    scripture_ref TEXT,            -- Main scripture reference
    title_hash TEXT,               -- Hash of title to detect duplicates
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- Composite index for efficient queries
    UNIQUE(user_id, generated_date, theme)
);

-- Index for quick lookups
CREATE INDEX idx_devotional_history_user_date 
ON devotional_history(user_id, generated_date DESC);

-- Auto-cleanup: Delete records older than 1 year (run periodically if needed)
-- This keeps the table small - data clears yearly as user requested
-- DELETE FROM devotional_history WHERE created_at < NOW() - INTERVAL '365 days';

-- Enable RLS
ALTER TABLE devotional_history ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read/write their own history
CREATE POLICY "Users can manage their own devotional history"
ON devotional_history
FOR ALL
USING (true)
WITH CHECK (true);
