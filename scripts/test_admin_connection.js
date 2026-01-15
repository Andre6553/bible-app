import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env');

// Manual .env parsing
let processEnv = {};
if (fs.existsSync(envPath)) {
    console.log('Found .env at:', envPath);
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const [key, ...values] = line.split('=');
        if (key && values) {
            processEnv[key.trim()] = values.join('=').trim();
        }
    });
} else {
    console.warn('No .env file found!');
}

const supabaseUrl = processEnv.VITE_SUPABASE_URL || 'https://fikjnvkzhemamtlwsrin.supabase.co';
const serviceRoleKey = processEnv.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
    console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function testConnection() {
    console.log('Testing Admin Access...');
    try {
        // Try to read profiles (usually RLS protected) using service role to bypass RLS
        const { count, error } = await supabase
            .from('user_profiles')
            .select('*', { count: 'exact', head: true });

        if (error) throw error;

        console.log(`✅ SUCCESS! Service Role Key is valid.`);
        console.log(`Current Total Users: ${count}`);

    } catch (err) {
        console.error('❌ Connection Failed:', err.message);
    }
}

testConnection();
