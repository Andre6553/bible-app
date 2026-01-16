-- Add sermon_audit_count to track Audit Sermon tool usage
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS sermon_audit_count INTEGER DEFAULT 0;
