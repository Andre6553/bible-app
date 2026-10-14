/**
 * Verifies Supabase env vars and anonymous API reachability (no user credentials).
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env');

function loadEnv(filePath) {
    const out = {};
    if (!fs.existsSync(filePath)) return out;
    for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq === -1) continue;
        out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }
    return out;
}

const env = loadEnv(envPath);
const supabaseUrl = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY;

const failures = [];
if (!supabaseUrl) failures.push('Missing VITE_SUPABASE_URL in .env');
if (!anonKey) failures.push('Missing VITE_SUPABASE_ANON_KEY in .env');

if (failures.length) {
    console.error('FAIL:', failures.join('; '));
    process.exit(1);
}

const supabase = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
    const { error } = await supabase.from('books').select('id', { count: 'exact', head: true });
    if (error) {
        console.error('FAIL: Supabase anon query failed:', error.message);
        process.exit(1);
    }

    const { data: { session } } = await supabase.auth.getSession();
    console.log('OK: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set');
    console.log('OK: Anonymous API query succeeded (books table reachable)');
    console.log('OK: Auth client initialized (session:', session ? 'present' : 'none', ')');
}

main().catch((err) => {
    console.error('FAIL:', err.message);
    process.exit(1);
});
