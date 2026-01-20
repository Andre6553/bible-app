import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

console.log('Reading .env file...');
const envPath = path.resolve(process.cwd(), '.env');
let env = {};
try {
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const val = parts.slice(1).join('=').trim();
            env[key] = val;
        }
    });
} catch (e) { console.error(e); }

const supabaseUrl = env.VITE_SUPABASE_URL || 'https://fikjnvkzhemamtlwsrin.supabase.co';
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) { console.error('Missing Key'); process.exit(1); }

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrate() {
    const sqlPath = path.resolve(process.cwd(), 'src/sql_imports/trivia_unique_fix.sql');
    try {
        const sql = fs.readFileSync(sqlPath, 'utf8');
        console.log(`Loaded SQL from ${sqlPath}`);
        const { error } = await supabase.rpc('exec_sql', { sql });
        if (error) console.error('❌ Failed:', error);
        else console.log('✅ Unique Constraint Applied');
    } catch (err) { console.error(err); }
}

migrate();
