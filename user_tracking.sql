
-- Add user_id column to track anonymous users
alter table search_logs 
add column if not exists user_id text;

-- Add index for performance when querying by user
create index if not exists idx_search_logs_user_id on search_logs(user_id);
