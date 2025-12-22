const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://fikjnvkzhemamtlwsrin.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpa2pudmt6aGVtYW10bHdzcmluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTUyMjc1MiwiZXhwIjoyMDgxMDk4NzUyfQ.BTrA9ojgOqXG8lUgvZX4aF9uqd3ShX2oGSLu4-8gnW4';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const sql = `
CREATE TABLE IF NOT EXISTS highlight_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    color TEXT NOT NULL,
    label TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, color)
);

CREATE INDEX IF NOT EXISTS idx_highlight_categories_user ON highlight_categories(user_id);
`;

async function applySql() {
    console.log('🚀 Attempting to apply Highlight Categories SQL...');

    // We can't run raw SQL directly without a custom RPC 'exec_sql'.
    // Instead, let's try to perform an operation and see if it fails because of missing table.
    // If it fails, we will guide the user to run the SQL in their dashboard.

    // But wait, there is no easy way to check if a table exists without a query.
    const { error } = await supabase.from('highlight_categories').select('id').limit(1);

    if (error && error.code === '42P01') { // 42P01 is "relation does not exist"
        console.error('❌ Table highlight_categories does not exist.');
        console.log('Please run the SQL in your Supabase SQL Editor:');
        console.log(sql);
        process.exit(1);
    } else if (error) {
        console.error('⚠️ Supabase Error:', error.message);
    } else {
        console.log('✅ Table highlight_categories exists.');
    }
}

applySql();
