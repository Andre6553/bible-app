-- SQL for saved word studies
CREATE TABLE IF NOT EXISTS public.word_studies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    verse_ref TEXT NOT NULL,
    book_id INTEGER NOT NULL,
    chapter INTEGER NOT NULL,
    verse INTEGER NOT NULL,
    word TEXT NOT NULL,
    original_word TEXT,
    lemma TEXT,
    transliteration TEXT,
    analysis JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Basic RLS for word_studies
ALTER TABLE public.word_studies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all word studies"
ON public.word_studies
FOR ALL
USING (true);
