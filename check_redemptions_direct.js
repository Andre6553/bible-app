
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '.env');

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

async function inspectRedemptions() {
    console.log('🔍 Inspecting Promo Redemptions...');

    // 1. Get Count
    const { count, error: countError } = await supabase
        .from('promo_redemptions')
        .select('*', { count: 'exact', head: true });

    if (countError) console.error('Count Error:', countError);
    console.log(`📊 Total Redemptions: ${count}`);

    // 2. Get Recent Rows
    const { data, error } = await supabase
        .from('promo_redemptions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('❌ Fetch Error:', error);
    } else {
        console.log('📄 Latest 5 Redemptions:');
        console.log(JSON.stringify(data, null, 2));
    }
}

inspectRedemptions();
