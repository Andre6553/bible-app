
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fikjnvkzhemamtlwsrin.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpa2pudmt6aGVtYW10bHdzcmluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1MjI3NTIsImV4cCI6MjA4MTA5ODc1Mn0.WdMBr3RCE8xLBugCeleMiTI6-lyZxhvf3LcFRo1D3q8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    console.log("Checking verses columns...");

    // Check verse_highlights
    const { data: hlData, error: hlError } = await supabase
        .from('verse_highlights')
        .select('*')
        .limit(1);

    if (hlError) {
        console.error("Error HL:", hlError);
    } else if (hlData && hlData.length > 0) {
        const row = hlData[0];
        console.log("Sample HL Row:", row);
        console.log("Type of book_id:", typeof row.book_id);
        console.log("Type of user_id:", typeof row.user_id);
        console.log("Val of user_id:", row.user_id);
    }
}

checkSchema();
