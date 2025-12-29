
-- Function to get ONLY orphaned highlights (uncategorized colors)
-- This avoids fetching thousands of categorized highlights just to find the few orphans.

-- Clean up potential duplicates to avoid ambiguity
DROP FUNCTION IF EXISTS get_orphaned_highlights(uuid);
DROP FUNCTION IF EXISTS get_orphaned_highlights(text);

CREATE OR REPLACE FUNCTION get_orphaned_highlights(p_user_id text)
RETURNS TABLE (
    id uuid,
    user_id text,
    book_id text, -- Assuming string based on previous check, but let's check input
    chapter int,
    verse int,
    version text,
    color text,
    created_at timestamptz,
    text text -- We can fetch text directly here too!
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        vh.id,
        vh.user_id,
        vh.book_id::text,
        vh.chapter,
        vh.verse,
        vh.version,
        vh.color,
        vh.created_at,
        v.text::text
    FROM 
        verse_highlights vh
    LEFT JOIN
        highlight_categories hc ON vh.user_id = hc.user_id AND vh.color = hc.color
    LEFT JOIN
        verses v ON vh.book_id::int = v.book_id AND vh.chapter = v.chapter AND vh.verse = v.verse AND vh.version = v.version
    WHERE 
        vh.user_id = p_user_id
        AND hc.color IS NULL
    ORDER BY 
        vh.created_at DESC;
END;
$$;
