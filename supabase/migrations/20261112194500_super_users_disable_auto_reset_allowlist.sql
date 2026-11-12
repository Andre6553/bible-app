-- Stop auto-adding every visitor/guest to super_users; keep explicit family allowlist only.
-- Apply: node scripts/run_sql.js supabase/migrations/20261112194500_super_users_disable_auto_reset_allowlist.sql

UPDATE public.app_settings
SET value = 'false', updated_at = now()
WHERE key = 'super_users_auto';

UPDATE public.app_settings
SET value = $json$[
  "andre.ecprint@gmail.com",
  "abigailvdw21@gmail.com",
  "elzannearline@gmail.com",
  "henry.futcher@gmail.com",
  "hettievanderwesthuizen1950@gmail.com",
  "justinvdw0604@gmail.com",
  "riaanvdw186@gmail.com"
]$json$::text,
    updated_at = now()
WHERE key = 'super_users';
