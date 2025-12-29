
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fikjnvkzhemamtlwsrin.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpa2pudmt6aGVtYW10bHdzcmluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1MjI3NTIsImV4cCI6MjA4MTA5ODc1Mn0.WdMBr3RCE8xLBugCeleMiTI6-lyZxhvf3LcFRo1D3q8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("Checking top users...");
    const targetUsers = [
        'eec764f0-9522-4c39-9e3a-dd2f5fee6d0b'
    ];

    for (const userId of targetUsers) {
        console.log(`\n--- User: ${userId} ---`);
        const { data, error } = await supabase
            .from('verse_highlights')
            .select('color, created_at')
            .eq('user_id', userId);

        if (error) { console.error(error); continue; }

        const colorCounts = {};
        data.forEach(h => {
            colorCounts[h.color] = (colorCounts[h.color] || 0) + 1;
        });

        console.log("Colors used:", colorCounts);
    }
}

check();
