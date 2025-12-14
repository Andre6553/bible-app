-- AI Bible Research Feature Database Schema
-- Run this in Supabase SQL Editor

-- Table 1: Track user AI questions
CREATE TABLE IF NOT EXISTS ai_questions (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    question TEXT NOT NULL,
    answer TEXT,
    cached BOOLEAN DEFAULT FALSE,
    verse_context TEXT, -- Store which verses were context
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_ai_questions_user_date ON ai_questions(user_id, DATE(created_at));
CREATE INDEX IF NOT EXISTS idx_ai_questions_date ON ai_questions(DATE(created_at));
CREATE INDEX IF NOT EXISTS idx_ai_questions_user ON ai_questions(user_id);

-- Table 2: Cache common answers
CREATE TABLE IF NOT EXISTS ai_cache (
    id BIGSERIAL PRIMARY KEY,
    question_hash TEXT UNIQUE NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    hit_count INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_cache_hash ON ai_cache(question_hash);

-- Table 3: Global quota settings
CREATE TABLE IF NOT EXISTS ai_quota (
    id INT PRIMARY KEY DEFAULT 1,
    current_quota INT DEFAULT 300, -- Start generous for early users
    active_users_count INT DEFAULT 0,
    last_calculated TIMESTAMP DEFAULT NOW(),
    total_api_calls_today INT DEFAULT 0,
    date DATE DEFAULT CURRENT_DATE
);

-- Initialize with default values
INSERT INTO ai_quota (id, current_quota, active_users_count)
VALUES (1, 300, 0)
ON CONFLICT (id) DO NOTHING;

-- Function to reset daily quota (run via cron or manually)
CREATE OR REPLACE FUNCTION reset_daily_quota()
RETURNS void AS $$
BEGIN
    UPDATE ai_quota SET
        total_api_calls_today = 0,
        last_calculated = NOW(),
        date = CURRENT_DATE
    WHERE id = 1;
END;
$$ LANGUAGE plpgsql;

-- View to check today's usage
CREATE OR REPLACE VIEW ai_usage_today AS
SELECT 
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(*) as total_questions,
    COUNT(*) FILTER (WHERE cached = true) as cached_questions,
    COUNT(*) FILTER (WHERE cached = false) as api_calls
FROM ai_questions
WHERE DATE(created_at) = CURRENT_DATE;
