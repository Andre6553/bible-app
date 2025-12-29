
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fikjnvkzhemamtlwsrin.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpa2pudmt6aGVtYW10bHdzcmluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1MjI3NTIsImV4cCI6MjA4MTA5ODc1Mn0.WdMBr3RCE8xLBugCeleMiTI6-lyZxhvf3LcFRo1D3q8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOrphanRPC() {
    console.log("Checking RPC 'get_orphaned_highlights'...");

    // We need a user ID. Usually we get it from auth, but for test we can try to guess or hardcode if we know one.
    // Let's use getUserId logic or just try to find a user from a highlight.
    // For now, let's grab a user_id from the first highlight we find.

    const { data: oneHL } = await supabase.from('verse_highlights').select('user_id').limit(1);
    if (!oneHL || !oneHL[0]) {
        console.log("No highlights found to test with.");
        return;
    }
    const testUserId = oneHL[0].user_id;
    console.log("Testing with User ID:", testUserId);

    const { data, error } = await supabase.rpc('get_orphaned_highlights', { p_user_id: testUserId });

    if (error) {
        console.error("❌ RPC Check Failed:", error.message);
        console.log("Details:", error);
    } else {
        console.log("✅ RPC Check Passed!");
        console.log(`Found ${data.length} orphaned highlights.`);
        if (data.length > 0) {
            console.log("Sample:", data[0]);
        }
    }
}

checkOrphanRPC();
