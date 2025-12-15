-- Add device_info column to search_logs
ALTER TABLE search_logs ADD COLUMN IF NOT EXISTS device_info TEXT;

-- Add device_info column to ai_questions
ALTER TABLE ai_questions ADD COLUMN IF NOT EXISTS device_info TEXT;
