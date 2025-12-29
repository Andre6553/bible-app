
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fikjnvkzhemamtlwsrin.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpa2pudmt6aGVtYW10bHdzcmluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1MjI3NTIsImV4cCI6MjA4MTA5ODc1Mn0.WdMBr3RCE8xLBugCeleMiTI6-lyZxhvf3LcFRo1D3q8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectUser() {
    const userId = 'eec764f0-9522-4c39-9e3a-dd2f5fee6d0b';
    console.log(`Inspecting categories for Auth User: ${userId}`);

    const { data: categories, error } = await supabase
        .from('highlight_categories')
        .select('*')
        .eq('user_id', userId);

    if (error) {
        console.error(error);
        return;
    }

    console.log(`Found ${categories.length} categories:`);
    categories.forEach(c => {
        console.log(`[Color: ${c.color}] Label: '${c.label}'`);
    });
}

inspectUser();
