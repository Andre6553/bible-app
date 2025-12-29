
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fikjnvkzhemamtlwsrin.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpa2pudmt6aGVtYW10bHdzcmluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1MjI3NTIsImV4cCI6MjA4MTA5ODc1Mn0.WdMBr3RCE8xLBugCeleMiTI6-lyZxhvf3LcFRo1D3q8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyze() {
    console.log("Fetching Categories...");
    const { data: categories, error } = await supabase
        .from('highlight_categories')
        .select('*');

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log(`\nFound ${categories.length} categories:`);
    console.log("---------------------------------------------------");

    // Process strictly sequentially to avoid stdout mangling
    const sorted = categories.sort((a, b) => a.label.localeCompare(b.label));

    for (const c of sorted) {
        console.log(`[Color: ${c.color}]  Label: "${c.label}"`);
        // Tiny pause to help certain terminals flash buffers
        await new Promise(r => setTimeout(r, 5));
    }
    console.log("---------------------------------------------------");
}

analyze();
