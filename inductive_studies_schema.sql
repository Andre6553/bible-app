-- SQL for inductive_studies table
CREATE TABLE IF NOT EXISTS public.inductive_studies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    book_id INTEGER,
    book_name TEXT,
    chapter INTEGER NOT NULL,
    verse_start INTEGER,
    verse_end INTEGER,
    title TEXT,
    observation JSONB DEFAULT '{}'::jsonb,
    interpretation JSONB DEFAULT '{}'::jsonb,
    application JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Basic RLS for inductive_studies (matches app's anonymous user model)
ALTER TABLE public.inductive_studies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all inductive studies"
ON public.inductive_studies
FOR ALL
USING (true);
