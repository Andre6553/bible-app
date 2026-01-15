import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://fikjnvkzhemamtlwsrin.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpa2pudmt6aGVtYW10bHdzcmluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1MjI3NTIsImV4cCI6MjA4MTA5ODc1Mn0.WdMBr3RCE8xLBugCeleMiTI6-lyZxhvf3LcFRo1D3q8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchBookMappings() {
    console.log('Fetching book mappings...');
    const { data, error } = await supabase
        .from('books')
        .select('id, name_full, "order"')
        .order('order');

    if (error) {
        console.error('Error fetching books:', error);
        return;
    }

    fs.writeFileSync('book_mapping.json', JSON.stringify(data, null, 2));
    console.log('Book mappings saved to book_mapping.json');
}

fetchBookMappings();
