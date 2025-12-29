
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fikjnvkzhemamtlwsrin.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpa2pudmt6aGVtYW10bHdzcmluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1MjI3NTIsImV4cCI6MjA4MTA5ODc1Mn0.WdMBr3RCE8xLBugCeleMiTI6-lyZxhvf3LcFRo1D3q8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function listUsers() {
    console.log("Fetching unique user IDs...");

    // Fetch all user_ids (using a raw cheat or just pagination)
    // For small DB, selecting all is fine.
    const { data: highlights, error } = await supabase
        .from('verse_highlights')
        .select('user_id');

    if (error) {
        console.error(error);
        return;
    }

    const userCounts = {};
    highlights.forEach(h => {
        const uid = h.user_id || 'NULL';
        userCounts[uid] = (userCounts[uid] || 0) + 1;
    });

    console.log(`\nFound ${Object.keys(userCounts).length} unique users:`);
    Object.entries(userCounts)
        .sort((a, b) => b[1] - a[1]) // Sort desc
        .forEach(([uid, count]) => {
            console.log(`User: ${uid} - ${count} highlights`);
        });
}

listUsers();
