-- Create books table
CREATE TABLE IF NOT EXISTS books (
    id SERIAL PRIMARY KEY,
    name_full TEXT NOT NULL,
    name_abbrev TEXT NOT NULL,
    testament TEXT CHECK (testament IN ('OT', 'NT')),
    "order" INTEGER NOT NULL
);

-- Create verses table
CREATE TABLE IF NOT EXISTS verses (
    id SERIAL PRIMARY KEY,
    book_id INTEGER REFERENCES books(id),
    chapter INTEGER NOT NULL,
    verse INTEGER NOT NULL,
    text TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT 'KJV'
);

-- Enable Row Level Security (RLS)
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE verses ENABLE ROW LEVEL SECURITY;

-- Create policies to allow public read access
DROP POLICY IF EXISTS "Allow public read access on books" ON books;
CREATE POLICY "Allow public read access on books" ON books FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read access on verses" ON verses;
CREATE POLICY "Allow public read access on verses" ON verses FOR SELECT USING (true);

-- Seed Books (Basic set for demo)
INSERT INTO books (name_full, name_abbrev, testament, "order") VALUES
('Genesis', 'Gen', 'OT', 1),
('Exodus', 'Exo', 'OT', 2),
('Leviticus', 'Lev', 'OT', 3),
('Numbers', 'Num', 'OT', 4),
('Deuteronomy', 'Deu', 'OT', 5),
('John', 'Jhn', 'NT', 43),
('Acts', 'Act', 'NT', 44),
('Romans', 'Rom', 'NT', 45)
ON CONFLICT (name_full) DO NOTHING;

-- Seed Gen 1 (KJV)
INSERT INTO verses (book_id, chapter, verse, text, version) 
SELECT id, 1, 1, 'In the beginning God created the heaven and the earth.', 'KJV' FROM books WHERE name_full = 'Genesis'
UNION ALL
SELECT id, 1, 2, 'And the earth was without form, and void; and darkness was upon the face of the deep. And the Spirit of God moved upon the face of the waters.', 'KJV' FROM books WHERE name_full = 'Genesis'
UNION ALL
SELECT id, 1, 3, 'And God said, Let there be light: and there was light.', 'KJV' FROM books WHERE name_full = 'Genesis'
UNION ALL
SELECT id, 1, 4, 'And God saw the light, that it was good: and God divided the light from the darkness.', 'KJV' FROM books WHERE name_full = 'Genesis'
UNION ALL
SELECT id, 1, 5, 'And God called the light Day, and the darkness he called Night. And the evening and the morning were the first day.', 'KJV' FROM books WHERE name_full = 'Genesis';

-- Seed Gen 1 (NLT)
INSERT INTO verses (book_id, chapter, verse, text, version) 
SELECT id, 1, 1, 'In the beginning God created the heavens and the earth.', 'NLT' FROM books WHERE name_full = 'Genesis'
UNION ALL
SELECT id, 1, 2, 'The earth was formless and empty, and darkness covered the deep waters. And the Spirit of God was hovering over the surface of the waters.', 'NLT' FROM books WHERE name_full = 'Genesis';

-- Create User Settings table for cloud sync (Themes, Font Size, etc.)
CREATE TABLE IF NOT EXISTS user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id)
);

-- Enable RLS on User Settings
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only manage their own settings
DROP POLICY IF EXISTS "Users can manage their own settings" ON user_settings;
CREATE POLICY "Users can manage their own settings" ON user_settings 
    FOR ALL USING (auth.uid()::text = user_id);
