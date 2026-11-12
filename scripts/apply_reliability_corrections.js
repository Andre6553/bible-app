// Apply only the reviewed Bible reliability correction, without printing credentials.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const root = new URL('../', import.meta.url);
const env = dotenv.parse(fs.readFileSync(new URL('.env', root)));
if (new URL(env.VITE_SUPABASE_URL).hostname !== 'fikjnvkzhemamtlwsrin.supabase.co') {
    throw new Error('Unexpected Supabase project; refusing migration.');
}
if (!env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing Bible service role credential.');
const client = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
});

try {
    const preflight = await client.rpc('get_maintainer_rls_export').abortSignal(AbortSignal.timeout(20000));
    if (preflight.error) throw new Error(`Preflight failed: ${preflight.error.message}`);
    console.log('Bible database connection verified.');
    if (!process.argv.includes('--apply')) {
        console.log('Read-only check complete; use --apply to submit the correction migration.');
    } else {
        const file = new URL('supabase/migrations/20261112100000_reliability_corrections.sql', root);
        const sql = fs.readFileSync(fileURLToPath(file), 'utf8');
        const result = await client.rpc('exec_sql', { sql }).abortSignal(AbortSignal.timeout(60000));
        if (result.error) throw new Error(`SQL application failed: ${result.error.message}`);
        console.log('Reliability correction migration applied successfully.');
    }
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
