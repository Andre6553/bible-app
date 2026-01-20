import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Parsers
const envPath = path.resolve(process.cwd(), '.env');
let env = {};
try {
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) env[parts[0].trim()] = parts.slice(1).join('=').trim();
    });
} catch (e) { }

const supabase = createClient(
    env.VITE_SUPABASE_URL || 'https://fikjnvkzhemamtlwsrin.supabase.co',
    env.SUPABASE_SERVICE_ROLE_KEY
);

async function migrate() {
    const sqlPath = path.resolve(process.cwd(), 'src/sql_imports/trivia_dedup_fix.sql');
    try {
        const sql = fs.readFileSync(sqlPath, 'utf8');
        console.log(`Loaded Fix SQL from ${sqlPath}`);
        const { error } = await supabase.rpc('exec_sql', { sql });
        if (error) console.error('❌ Failed:', error);
        else console.log('✅ Deduplicated and Constraint Applied');
    } catch (err) { console.error('❌ Script Error:', err.message); }
}

migrate();
