import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fikjnvkzhemamtlwsrin.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpa2pudmt6aGVtYW10bHdzcmluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1MjI3NTIsImV4cCI6MjA4MTA5ODc1Mn0.WdMBr3RCE8xLBugCeleMiTI6-lyZxhvf3LcFRo1D3q8';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDuplicates() {
    console.log('Checking for duplicate books...');
    const { data: books, error } = await supabase
        .from('books')
        .select('*');

    if (error) {
        console.error('Error:', error);
        return;
    }

    const nameCounts = {};
    const duplicates = [];

    books.forEach(book => {
        if (!nameCounts[book.name_full]) {
            nameCounts[book.name_full] = [];
        }
        nameCounts[book.name_full].push(book);
    });

    for (const [name, list] of Object.entries(nameCounts)) {
        if (list.length > 1) {
            duplicates.push({ name, count: list.length, ids: list.map(b => b.id) });
        }
    }

    if (duplicates.length === 0) {
        console.log('No duplicates found.');
    } else {
        console.log('Duplicates found:');
        console.log(JSON.stringify(duplicates, null, 2));
    }
}

checkDuplicates();
