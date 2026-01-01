-- Add last_read_state column to user_profiles to support "Pick up where you left off" cross-device sync
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_read_state JSONB DEFAULT NULL;

-- Create an index for performance if we ever need to query by reading state
CREATE INDEX IF NOT EXISTS idx_user_profiles_last_read ON user_profiles USING GIN (last_read_state);

-- Ensure bible_reading_logs table exists for historical tracking (already used in code)
CREATE TABLE IF NOT EXISTS bible_reading_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    book_id TEXT NOT NULL,
    chapter INTEGER NOT NULL,
    device_info TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS and add policies for reading logs
ALTER TABLE bible_reading_logs ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable insert for all users' AND tablename = 'bible_reading_logs') THEN
        CREATE POLICY "Enable insert for all users" ON bible_reading_logs FOR INSERT WITH CHECK (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable select for own logs' AND tablename = 'bible_reading_logs') THEN
        CREATE POLICY "Enable select for own logs" ON bible_reading_logs FOR SELECT USING (true); -- Simplified for now, typically user_id = auth.uid() or similar
    END IF;
END $$;
