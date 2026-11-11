/**
 * Read-only live audit for Omni Bible Supabase (fikjnvkzhemamtlwsrin).
 * Uses service role + exec_sql to SELECT catalog state; creates/drops temp views only.
 * Run: node scripts/live_verify_readonly.js
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env');

let processEnv = {};
if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8')
        .split('\n')
        .forEach((line) => {
            const [key, ...values] = line.split('=');
            if (key && values.length) processEnv[key.trim()] = values.join('=').trim();
        });
}

const supabaseUrl = processEnv.VITE_SUPABASE_URL || 'https://fikjnvkzhemamtlwsrin.supabase.co';
const serviceRoleKey = processEnv.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
    console.error('Missing SUPABASE_SERVICE_ROLE_KEY in Bible/.env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const VIEW = 'temp_live_verify_' + Date.now();

const auditSql = `
CREATE OR REPLACE VIEW ${VIEW} AS
SELECT json_build_object(
  'project_host', current_database(),
  'rls', (
    SELECT json_agg(json_build_object(
      'table', c.relname,
      'rls_enabled', c.relrowsecurity,
      'rls_forced', c.relforcerowsecurity
    ) ORDER BY c.relname)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname IN (
        'user_profiles', 'highlights', 'verse_notes', 'reading_plan_enrollments',
        'payment_history', 'blog_posts'
      )
  ),
  'policies_user_profiles', (
    SELECT coalesce(json_agg(json_build_object(
      'name', policyname,
      'cmd', cmd,
      'roles', roles
    ) ORDER BY policyname), '[]'::json)
    FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_profiles'
  ),
  'risky_functions', (
    SELECT coalesce(json_agg(json_build_object(
      'name', p.proname,
      'security_definer', p.prosecdef,
      'execute_for_anon', has_function_privilege('anon', p.oid, 'EXECUTE'),
      'execute_for_authenticated', has_function_privilege('authenticated', p.oid, 'EXECUTE'),
      'execute_for_service_role', has_function_privilege('service_role', p.oid, 'EXECUTE')
    ) ORDER BY p.proname), '[]'::json)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'exec_sql', 'increment_usage', 'increment_column',
        'admin_set_subscription', 'set_user_subscription'
      )
  ),
  'exec_sql_callable', EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'exec_sql'
      AND (has_function_privilege('anon', p.oid, 'EXECUTE')
        OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))
  )
) AS snapshot;
GRANT SELECT ON ${VIEW} TO service_role;
`;

async function main() {
    console.log('Supabase URL:', supabaseUrl);

    const anonKey = processEnv.VITE_SUPABASE_ANON_KEY;
    if (anonKey) {
        const anon = createClient(supabaseUrl, anonKey);
        const { error: anonErr } = await anon.rpc('exec_sql', { sql: 'SELECT 1' });
        console.log(
            'anon exec_sql:',
            anonErr ? `BLOCKED (${anonErr.message})` : 'CALLABLE — critical if true'
        );
    }

    const { error: createErr } = await supabase.rpc('exec_sql', { sql: auditSql });
    if (createErr) {
        console.error('Audit view creation failed:', createErr.message);
        process.exit(1);
    }

    const { data, error } = await supabase.from(VIEW).select('snapshot').single();
    if (error) {
        console.error('Audit read failed:', error.message);
        process.exit(1);
    }

    console.log(JSON.stringify(data.snapshot, null, 2));

    await supabase.rpc('exec_sql', { sql: `DROP VIEW IF EXISTS ${VIEW};` });
}

main();
