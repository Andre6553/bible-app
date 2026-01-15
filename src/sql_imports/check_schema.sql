
SELECT
    table_name,
    column_name,
    data_type,
    udt_name
FROM
    information_schema.columns
WHERE
    table_name IN ('verse_notes', 'study_collections', 'note_labels', 'user_labels')
ORDER BY
    table_name, column_name;
