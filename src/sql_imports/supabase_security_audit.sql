-- SUPABASE SECURITY AUDIT: ROW LEVEL SECURITY (RLS) POLICIES
-- Target: Ensure total data isolation between users while preserving Admin access.
-- VERSION: 100% RECURSION-PROOF "NUKE & REBUILD"

-- ==========================================
-- STEP 0: CLEANUP (Kill all old policies)
-- ==========================================
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- ==========================================
-- STEP 1: HELPER FUNCTIONS (Loop-Proof)
-- ==========================================
-- This function ONLY checks the JWT. It NEVER calls the database.
-- This makes it 100% impossible to cause infinite recursion.
CREATE OR REPLACE FUNCTION public.is_admin_jwt()
RETURNS boolean AS $$
BEGIN
  RETURN lower(auth.jwt() ->> 'email') = 'andre.ecprint@gmail.com';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ==========================================
-- STEP 2: ENABLE RLS ON ALL TABLES
-- ==========================================
ALTER TABLE public.verse_highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verse_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sermons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devotional_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bible_reading_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_quota ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_devotionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.word_studies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inductive_studies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.highlight_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_labels ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- STEP 3: DEFINE DEFINITIVE POLICIES
-- ==========================================

-- Standard Owner access template:
-- Policy: (auth.uid()::text = user_id::text OR public.is_admin_jwt())

-- 1. VERSE_HIGHLIGHTS
CREATE POLICY "owner_admin_highlights" ON public.verse_highlights FOR ALL USING (auth.uid()::text = user_id::text OR public.is_admin_jwt());

-- 2. VERSE_NOTES
CREATE POLICY "owner_admin_notes" ON public.verse_notes FOR ALL USING (auth.uid()::text = user_id::text OR public.is_admin_jwt());

-- 3. STUDY_COLLECTIONS
CREATE POLICY "owner_admin_collections" ON public.study_collections FOR ALL USING (auth.uid()::text = user_id::text OR public.is_admin_jwt());

-- 4. SERMONS
CREATE POLICY "owner_admin_sermons" ON public.sermons FOR ALL USING (auth.uid()::text = user_id::text OR public.is_admin_jwt());

-- 5. USER_PROFILES
CREATE POLICY "owner_admin_profiles" ON public.user_profiles FOR ALL USING (auth.uid()::text = user_id::text OR public.is_admin_jwt());

-- 6. DEVOTIONAL_HISTORY
CREATE POLICY "owner_admin_devotionals" ON public.devotional_history FOR ALL USING (auth.uid()::text = user_id::text OR public.is_admin_jwt());

-- 7. SEARCH_LOGS
CREATE POLICY "owner_admin_search" ON public.search_logs FOR ALL USING (auth.uid()::text = user_id::text OR public.is_admin_jwt());

-- 8. API_USAGE_LOGS
CREATE POLICY "admin_only_api" ON public.api_usage_logs FOR ALL USING (public.is_admin_jwt());

-- 9. APP_SETTINGS
CREATE POLICY "public_read_settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "admin_all_settings" ON public.app_settings FOR ALL USING (public.is_admin_jwt());

-- 10. WORD_STUDIES
CREATE POLICY "owner_admin_word_studies" ON public.word_studies FOR ALL USING (auth.uid()::text = user_id::text OR public.is_admin_jwt());

-- 11. HIGHLIGHT_CATEGORIES
CREATE POLICY "owner_admin_categories" ON public.highlight_categories FOR ALL USING (auth.uid()::text = user_id::text OR public.is_admin_jwt());

-- 12. USER_LABELS
CREATE POLICY "owner_admin_labels" ON public.user_labels FOR ALL USING (auth.uid()::text = user_id::text OR public.is_admin_jwt());

-- 13. NOTE_LABELS (Special: Check parent note ownership)
CREATE POLICY "owner_admin_note_labels" ON public.note_labels FOR ALL USING (
    EXISTS (SELECT 1 FROM public.verse_notes WHERE id = note_id AND (user_id = auth.uid()::text OR public.is_admin_jwt()))
);

-- 14. BIBLE_READING_LOGS
CREATE POLICY "owner_admin_reading_logs" ON public.bible_reading_logs FOR ALL USING (auth.uid()::text = user_id::text OR public.is_admin_jwt());

-- 15. STATIC CONTENT (Verses & Books) - PUBLIC READ
-- Ensure we enable RLS so we can control it (though we want public read)
ALTER TABLE public.verses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_verses" ON public.verses FOR SELECT USING (true);
CREATE POLICY "public_read_books" ON public.books FOR SELECT USING (true);

-- Admin write access for static content (just in case)
CREATE POLICY "admin_write_verses" ON public.verses FOR INSERT WITH CHECK (public.is_admin_jwt());
CREATE POLICY "admin_update_verses" ON public.verses FOR UPDATE USING (public.is_admin_jwt());
CREATE POLICY "admin_delete_verses" ON public.verses FOR DELETE USING (public.is_admin_jwt());

CREATE POLICY "admin_write_books" ON public.books FOR INSERT WITH CHECK (public.is_admin_jwt());
CREATE POLICY "admin_update_books" ON public.books FOR UPDATE USING (public.is_admin_jwt());
CREATE POLICY "admin_delete_books" ON public.books FOR DELETE USING (public.is_admin_jwt());

-- ==========================================
-- FINAL ACTION: NO DELAY
-- ==========================================
-- The database is now unlocked.
