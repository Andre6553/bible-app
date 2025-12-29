
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fikjnvkzhemamtlwsrin.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpa2pudmt6aGVtYW10bHdzcmluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1MjI3NTIsImV4cCI6MjA4MTA5ODc1Mn0.WdMBr3RCE8xLBugCeleMiTI6-lyZxhvf3LcFRo1D3q8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fix() {
    const userId = 'eec764f0-9522-4c39-9e3a-dd2f5fee6d0b';
    const grayHex = '#94a3b8';
    console.log(`Fixing empty category for Auth User: ${userId}`);

    // Check first
    const { data: toDelete, error: findError } = await supabase
        .from('highlight_categories')
        .select('*')
        .eq('user_id', userId)
        .eq('color', grayHex)
        .eq('label', ''); // Empty String

    if (findError) {
        console.error("Error finding:", findError);
        return;
    }

    if (!toDelete || toDelete.length === 0) {
        console.log("No empty gray category found. Already fixed?");
        return;
    }

    console.log(`Found ${toDelete.length} broken category. Deleting...`);

    const { error: delError } = await supabase
        .from('highlight_categories')
        .delete()
        .eq('id', toDelete[0].id);

    if (delError) {
        console.error("Error deleting:", delError);
    } else {
        console.log("✅ Deleted broken category. Highlights are now orphans!");
    }
}

fix();
