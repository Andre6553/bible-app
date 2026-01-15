import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env');

let processEnv = {};
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const [key, ...values] = line.split('=');
        if (key && values) processEnv[key.trim()] = values.join('=').trim();
    });
}

const supabaseUrl = processEnv.VITE_SUPABASE_URL || 'https://fikjnvkzhemamtlwsrin.supabase.co';
const serviceRoleKey = processEnv.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

const sqlFilePath = process.argv[2];

if (!sqlFilePath) {
    console.error('Usage: node scripts/run_sql.js <path_to_sql_file>');
    process.exit(1);
}

async function runSql() {
    const fullPath = path.resolve(sqlFilePath);
    if (!fs.existsSync(fullPath)) {
        console.error('❌ SQL file not found:', fullPath);
        process.exit(1);
    }

    const sqlContent = fs.readFileSync(fullPath, 'utf8');
    console.log(`Running SQL from: ${path.basename(fullPath)}...`);

    try {
        const { error } = await supabase.rpc('exec_sql', { sql: sqlContent });
        if (error) throw error;
        console.log('✅ SQL executed successfully.');
    } catch (err) {
        console.error('❌ Execution Failed:', err.message);
    }
}

runSql();
