const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env
const envPath = path.resolve(__dirname, '../.env');
let env = {};

if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    lines.forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const value = parts.slice(1).join('=').trim();
            env[key] = value;
        }
    });
}

const supabaseUrl = env.VITE_SUPABASE_URL || 'https://fikjnvkzhemamtlwsrin.supabase.co';
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
    console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY is missing from .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkUsers() {
    console.log('🔍 Checking User Profiles for Admin Status...');
    console.log('URL:', supabaseUrl);

    // split check
    const { data: d1, error: e1 } = await supabase.from('user_profiles').select('*').ilike('email', '%test@gmail.com%');
    console.log('Test User Check:', e1 || d1);

    const { data: d2, error: e2 } = await supabase.from('user_profiles').select('*').ilike('email', '%andre.ecprint@gmail.com%');
    console.log('Andre User Check:', e2 || d2);
}

checkUsers();
