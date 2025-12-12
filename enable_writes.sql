-- Allow Insert/Update/Delete on Books
create policy "Enable insert for anon" on books for insert with check (true);
create policy "Enable update for anon" on books for update using (true);

-- Allow Insert/Delete on Verses
create policy "Enable insert for anon" on verses for insert with check (true);
create policy "Enable delete for anon" on verses for delete using (true);

-- Note: In a production app, you would want to restrict these!
-- But for this initial seeding, we need them open.

-- Add unique constraint to books.name_full to support upsert
ALTER TABLE books ADD CONSTRAINT books_name_full_key UNIQUE (name_full);
