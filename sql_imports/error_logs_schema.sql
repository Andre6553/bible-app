-- Create the app_errors table
CREATE TABLE IF NOT EXISTS app_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    error_message TEXT NOT NULL,
    stack_trace TEXT,
    component_stack TEXT,
    url TEXT,
    user_agent TEXT,
    device_info JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE app_errors ENABLE ROW LEVEL SECURITY;

-- Policy: Allow ANYONE (anon and auth) to INSERT errors
-- We need unauthenticated users to be able to report crash logs too (e.g. crash on login)
CREATE POLICY "Enable insert for all users" 
ON app_errors FOR INSERT 
WITH CHECK (true);

-- Policy: Only Admins/Service Role should be able to SELECT/DELETE
-- For this app's simplicity (and matching Stats page logic), we might allow authenticated users to read
-- OR strictly limit it. As per Stats.jsx generally handling "admin" via PIN + Supabase select permissions.
-- We'll allow Select for now to ensure Stats page works easily, assuming RLS isn't blocking the "admin" user.
-- Better security: Only allow specific UUIDs, but usually for these prototypes we allow Authenticated Read.
CREATE POLICY "Enable select for authenticated users" 
ON app_errors FOR SELECT 
USING (auth.role() = 'authenticated');

-- Policy: Allow authenticated delete (for clearing logs)
CREATE POLICY "Enable delete for authenticated users" 
ON app_errors FOR DELETE 
USING (auth.role() = 'authenticated');
