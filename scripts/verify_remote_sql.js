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

const sqlFile = process.argv[2];

async function runSql() {
    if (!sqlFile) {
        console.error('Usage: node verify_remote_sql.js <path_to_sql_file>');
        process.exit(1);
    }

    const filePath = path.resolve(process.cwd(), sqlFile);
    if (!fs.existsSync(filePath)) {
        console.error(`❌ File not found: ${filePath}`);
        process.exit(1);
    }

    const sqlContent = fs.readFileSync(filePath, 'utf8');
    console.log(`📂 Executing SQL from: ${sqlFile}`);

    try {
        const { data, error } = await supabase.rpc('exec_sql', {
            sql: sqlContent
        });

        if (error) {
            console.error('❌ SQL Execution Failed:', error.message);
            console.error('Details:', error);
        } else {
            console.log('✅ SQL Executed Successfully');
            if (data) {
                console.log('📄 Output:', JSON.stringify(data, null, 2));
            }
        }

    } catch (err) {
        console.error('❌ Unexpected Error:', err.message);
    }
}

runSql();
