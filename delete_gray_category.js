
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fikjnvkzhemamtlwsrin.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpa2pudmt6aGVtYW10bHdzcmluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1MjI3NTIsImV4cCI6MjA4MTA5ODc1Mn0.WdMBr3RCE8xLBugCeleMiTI6-lyZxhvf3LcFRo1D3q8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteGray() {
    console.log("Looking for 'gray' categories to delete...");

    // Find categories with label 'gray' (case insensitive)
    const { data: categories, error } = await supabase
        .from('highlight_categories')
        .select('*')
        .ilike('label', 'gray');

    if (error) {
        console.error("Error finding categories:", error);
        return;
    }

    if (!categories || categories.length === 0) {
        console.log("No 'gray' categories found.");
        return;
    }

    console.log(`Found ${categories.length} 'gray' categories.`);

    // Delete them
    for (const c of categories) {
        console.log(`Deleting category for user ${c.user_id} (Color: ${c.color}, Label: ${c.label})`);
        const { error: delError } = await supabase
            .from('highlight_categories')
            .delete()
            .eq('id', c.id);

        if (delError) {
            console.error("Error deleting:", delError);
        } else {
            console.log("✅ Deleted.");
        }
    }
}

deleteGray();
