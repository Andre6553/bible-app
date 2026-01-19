import { createClient } from '@supabase/supabase-js';

// Hardcoded keys
const supabaseUrl = 'https://fikjnvkzhemamtlwsrin.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpa2pudmt6aGVtYW10bHdzcmluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1MjI3NTIsImV4cCI6MjA4MTA5ODc1Mn0.WdMBr3RCE8xLBugCeleMiTI6-lyZxhvf3LcFRo1D3q8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBooks() {
    console.log('Checking verse counts per book for ESV...');

    // 1. Get all books
    const { data: books, error: bookError } = await supabase
        .from('books')
        .select('id, name_full, testament')
        .order('id');

    if (bookError) {
        console.error('Error fetching books:', bookError);
        return;
    }

    console.log(`DB has ${books.length} books.`);

    // 2. Check counts for each
    for (const book of books) {
        const { count, error } = await supabase
            .from('verses')
            .select('*', { count: 'exact', head: true })
            .eq('version', 'ESV')
            .eq('book_id', book.id);

        if (count === 0) {
            console.log(`❌ Book ID ${book.id} (${book.name_full}) has 0 verses!`);
        }
    }
    console.log('Done.');
}

checkBooks();
