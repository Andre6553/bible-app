
-- Function to fetch multiple verse texts in one request
-- Accepts a JSON array of { bookId, chapter, verse, version }
CREATE OR REPLACE FUNCTION get_verse_texts(requests JSONB)
RETURNS TABLE (
    book_id text,
    chapter int,
    verse int,
    version text,
    text text
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        v.book_id,
        v.chapter,
        v.verse,
        v.version,
        v.text
    FROM 
        verses v
    JOIN 
        jsonb_array_elements(requests) r 
        ON v.book_id = (r->>'bookId')::int 
        AND v.chapter = (r->>'chapter')::int 
        AND v.verse = (r->>'verse')::int
        AND v.version = r->>'version';
END;
$$;
