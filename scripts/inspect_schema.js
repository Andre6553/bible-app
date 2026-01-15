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

async function inspectSchema() {
    console.log('Inspecting user_profiles Policies...');

    // We can't SELECT from pg_policies via standard API, but we can creating a temp view or function?
    // Actually, exec_sql returns void. We can't GET data back easily unless we insert it somewhere.
    // Workaround: We will use exec_sql to CREATE A VIEW that exposes the policies, then read the view.

    try {
        await supabase.rpc('exec_sql', {
            sql: `
                CREATE OR REPLACE VIEW temp_policy_inspector AS
                SELECT tablename, policyname, roles, cmd, qual, with_check 
                FROM pg_policies 
                WHERE tablename = 'user_profiles';
                GRANT SELECT ON temp_policy_inspector TO service_role;
            `
        });

        const { data, error } = await supabase
            .from('temp_policy_inspector')
            .select('*');

        if (error) throw error;

        console.log('---------------- POLICIES ----------------');
        console.log(JSON.stringify(data, null, 2));
        console.log('------------------------------------------');

        // Cleanup
        await supabase.rpc('exec_sql', { sql: 'DROP VIEW temp_policy_inspector;' });

    } catch (err) {
        console.error('Inspection Failed:', err);
    }
}

inspectSchema();
