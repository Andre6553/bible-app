-- Allow Insert/Update/Delete on Books
DROP POLICY IF EXISTS "Enable insert for anon" on books;
create policy "Enable insert for anon" on books for insert with check (true);
DROP POLICY IF EXISTS "Enable update for anon" on books;
create policy "Enable update for anon" on books for update using (true);

-- Allow Insert/Delete on Verses
DROP POLICY IF EXISTS "Enable insert for anon" on verses;
create policy "Enable insert for anon" on verses for insert with check (true);
DROP POLICY IF EXISTS "Enable delete for anon" on verses;
create policy "Enable delete for anon" on verses for delete using (true);

-- Note: In a production app, you would want to restrict these!
-- But for this initial seeding, we need them open.

-- Add deduplication logic for books
-- Move verses to the first occurrence of each book name
UPDATE verses v
SET book_id = first_occurrence.id
FROM (
  SELECT name_full, MIN(id) as id
  FROM books
  GROUP BY name_full
) first_occurrence
JOIN books b ON b.name_full = first_occurrence.name_full
WHERE v.book_id = b.id AND v.book_id != first_occurrence.id;

-- Delete all but the first occurrence of each book name
DELETE FROM books
WHERE id NOT IN (
  SELECT MIN(id)
  FROM books
  GROUP BY name_full
);

-- Add unique constraint to books.name_full to support upsert
-- Check if it already exists to avoid errors
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'books_name_full_key') THEN
        ALTER TABLE books ADD CONSTRAINT books_name_full_key UNIQUE (name_full);
    END IF;
END $$;
