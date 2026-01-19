import { createClient } from '@supabase/supabase-js';

// Hardcoded from src/config/supabaseClient.js and .env (viewed previously)
const supabaseUrl = 'https://fikjnvkzhemamtlwsrin.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpa2pudmt6aGVtYW10bHdzcmluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1MjI3NTIsImV4cCI6MjA4MTA5ODc1Mn0.WdMBr3RCE8xLBugCeleMiTI6-lyZxhvf3LcFRo1D3q8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCount() {
    console.log('Checking ESV count as ANON user...');

    // Check total count
    const { count, error } = await supabase
        .from('verses')
        .select('*', { count: 'exact', head: true })
        .eq('version', 'ESV');

    if (error) {
        console.error('Error:', error);
    } else {
        console.log(`Anon Visible Verses: ${count}`);
    }
}

checkCount();
