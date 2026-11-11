/**
 * Export public RLS policies via service-role exec_sql (read-only audit).
 * Usage: node scripts/export_rls_policies.js
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env');

const processEnv = {};
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const [key, ...values] = line.split('=');
    if (key && values.length) processEnv[key.trim()] = values.join('=').trim();
  });
}

const supabaseUrl = processEnv.VITE_SUPABASE_URL;
const serviceRoleKey = processEnv.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in Bible/.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const { data, error } = await supabase.rpc('get_maintainer_rls_export');
if (error) {
  console.error('exec_sql failed:', error.message);
  process.exit(1);
}

const outDir = path.resolve(__dirname, '../docs');
const outFile = path.join(outDir, 'RLS_POLICIES_EXPORT_LATEST.json');
fs.writeFileSync(outFile, JSON.stringify(data, null, 2));
console.log('Wrote', outFile);
