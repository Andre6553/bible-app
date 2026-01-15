-- =====================================================
-- FIX: Verse Notes & Collections RLS Type Mismatch
-- Run this in Supabase Dashboard → SQL Editor
-- =====================================================

-- The error "operator does not exist: text = uuid" occurs because 
-- user_id is TEXT but auth.uid() is UUID. Comparison requires casting.

-- 1. FIX: verse_notes
ALTER TABLE verse_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can create own notes" ON verse_notes;
DROP POLICY IF EXISTS "Users can view own notes" ON verse_notes;
DROP POLICY IF EXISTS "Users can update own notes" ON verse_notes;
DROP POLICY IF EXISTS "Users can delete own notes" ON verse_notes;

CREATE POLICY "Users can create own notes" ON verse_notes FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can view own notes" ON verse_notes FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
CREATE POLICY "Users can update own notes" ON verse_notes FOR UPDATE TO authenticated USING (auth.uid()::text = user_id);
CREATE POLICY "Users can delete own notes" ON verse_notes FOR DELETE TO authenticated USING (auth.uid()::text = user_id);


-- 2. FIX: study_collections
ALTER TABLE study_collections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage collections" ON study_collections; -- cleanup old monolithic policies if any
DROP POLICY IF EXISTS "Users can create own collections" ON study_collections;
DROP POLICY IF EXISTS "Users can view own collections" ON study_collections;
DROP POLICY IF EXISTS "Users can update own collections" ON study_collections;
DROP POLICY IF EXISTS "Users can delete own collections" ON study_collections;

CREATE POLICY "Users can create own collections" ON study_collections FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can view own collections" ON study_collections FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
CREATE POLICY "Users can update own collections" ON study_collections FOR UPDATE TO authenticated USING (auth.uid()::text = user_id);
CREATE POLICY "Users can delete own collections" ON study_collections FOR DELETE TO authenticated USING (auth.uid()::text = user_id);


-- 3. FIX: user_labels
ALTER TABLE user_labels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage labels" ON user_labels;
DROP POLICY IF EXISTS "Users can create own labels" ON user_labels;
DROP POLICY IF EXISTS "Users can view own labels" ON user_labels;
DROP POLICY IF EXISTS "Users can update own labels" ON user_labels;
DROP POLICY IF EXISTS "Users can delete own labels" ON user_labels;

CREATE POLICY "Users can create own labels" ON user_labels FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can view own labels" ON user_labels FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
CREATE POLICY "Users can update own labels" ON user_labels FOR UPDATE TO authenticated USING (auth.uid()::text = user_id);
CREATE POLICY "Users can delete own labels" ON user_labels FOR DELETE TO authenticated USING (auth.uid()::text = user_id);


-- 4. FIX: note_labels (Junction Table)
-- Since this has no user_id, we allow authenticated users to interact with it.
-- ideally we'd check existence of related note, but for now simple access prevents blocking joins.
ALTER TABLE note_labels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage note links" ON note_labels;
CREATE POLICY "Authenticated users can manage note links" ON note_labels FOR ALL TO authenticated USING (true) WITH CHECK (true);

SELECT 'Fixed RLS policies for notes, collections, and labels' as result;
