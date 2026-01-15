import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env');

// Manual .env parsing
let processEnv = {};
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const [key, ...values] = line.split('=');
        if (key && values) {
            processEnv[key.trim()] = values.join('=').trim();
        }
    });
}

const supabaseUrl = processEnv.VITE_SUPABASE_URL || 'https://fikjnvkzhemamtlwsrin.supabase.co';
const serviceRoleKey = processEnv.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
    console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function testRemoteSql() {
    console.log('Testing Remote SQL Execution...');
    try {
        // Attempt to create a temp table using the new RPC
        const { error } = await supabase.rpc('exec_sql', {
            sql: 'CREATE TABLE IF NOT EXISTS temp_agent_check (id serial primary key, check_time timestamptz default now());'
        });

        if (error) throw error;

        console.log(`✅ SUCCESS! Created table via remote 'exec_sql'.`);

        // Cleanup
        await supabase.rpc('exec_sql', { sql: 'DROP TABLE temp_agent_check;' });
        console.log(`✅ SUCCESS! Cleaned up table.`);

    } catch (err) {
        console.error('❌ Remote SQL Failed:', err.message);
    }
}

testRemoteSql();
