-- Inspect column types for the tables involved in stats
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('user_profiles', 'search_logs', 'ai_questions', 'sermons')
AND column_name = 'user_id';
