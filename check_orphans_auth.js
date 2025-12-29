
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fikjnvkzhemamtlwsrin.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpa2pudmt6aGVtYW10bHdzcmluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1MjI3NTIsImV4cCI6MjA4MTA5ODc1Mn0.WdMBr3RCE8xLBugCeleMiTI6-lyZxhvf3LcFRo1D3q8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const userId = 'eec764f0-9522-4c39-9e3a-dd2f5fee6d0b';
    console.log(`Checking orphans for Auth User: ${userId}`);

    // Direct RPC call
    const { data, error } = await supabase.rpc('get_orphaned_highlights', { p_user_id: userId });

    if (error) {
        console.error("RPC Error:", error);
        return;
    }

    console.log(`RPC returned ${data.length} orphans.`);

    // Check if any are gray
    const grays = data.filter(h => h.color === '#94a3b8');
    console.log(`Gray orphans count: ${grays.length}`);
}

check();
