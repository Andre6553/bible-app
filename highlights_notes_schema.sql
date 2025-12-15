-- Verse Highlighting & Notes Schema
-- Run this in Supabase SQL Editor

-- Table for verse highlights (colors)
CREATE TABLE IF NOT EXISTS verse_highlights (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    book_id TEXT NOT NULL,
    chapter INT NOT NULL,
    verse INT NOT NULL,
    version TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#22c55e',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, book_id, chapter, verse, version)
);

-- Table for study collections (group scriptures by topic)
CREATE TABLE IF NOT EXISTS study_collections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#6366f1',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for verse notes
CREATE TABLE IF NOT EXISTS verse_notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    book_id TEXT NOT NULL,
    chapter INT NOT NULL,
    verse INT NOT NULL,
    version TEXT NOT NULL,
    note_text TEXT NOT NULL,
    study_id UUID REFERENCES study_collections(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, book_id, chapter, verse, version)
);

-- Table for user-defined labels
CREATE TABLE IF NOT EXISTS user_labels (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#64748b',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- Junction table for note-label relationships
CREATE TABLE IF NOT EXISTS note_labels (
    note_id UUID REFERENCES verse_notes(id) ON DELETE CASCADE,
    label_id UUID REFERENCES user_labels(id) ON DELETE CASCADE,
    PRIMARY KEY (note_id, label_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_highlights_user ON verse_highlights(user_id);
CREATE INDEX IF NOT EXISTS idx_highlights_book_chapter ON verse_highlights(book_id, chapter);
CREATE INDEX IF NOT EXISTS idx_notes_user ON verse_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_study ON verse_notes(study_id);
CREATE INDEX IF NOT EXISTS idx_studies_user ON study_collections(user_id);
CREATE INDEX IF NOT EXISTS idx_labels_user ON user_labels(user_id);

-- Enable RLS
ALTER TABLE verse_highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE verse_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_labels ENABLE ROW LEVEL SECURITY;

-- Allow all operations (since we're using anonymous user_ids)
CREATE POLICY "Allow all highlights" ON verse_highlights FOR ALL USING (true);
CREATE POLICY "Allow all notes" ON verse_notes FOR ALL USING (true);
CREATE POLICY "Allow all studies" ON study_collections FOR ALL USING (true);
CREATE POLICY "Allow all labels" ON user_labels FOR ALL USING (true);
CREATE POLICY "Allow all note_labels" ON note_labels FOR ALL USING (true);
