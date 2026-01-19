import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fikjnvkzhemamtlwsrin.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpa2pudmt6aGVtYW10bHdzcmluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1MjI3NTIsImV4cCI6MjA4MTA5ODc1Mn0.WdMBr3RCE8xLBugCeleMiTI6-lyZxhvf3LcFRo1D3q8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function dumpBooks() {
    const { data: books, error } = await supabase
        .from('books')
        .select('id, name_full, testament, order') // 'order' column might exist?
        .order('id');

    if (error) console.error(error);
    else {
        console.log('ID | Name | Order');
        books.forEach(b => console.log(`${b.id} | ${b.name_full} | ${b.order || '?'}`));
    }
}

dumpBooks();
