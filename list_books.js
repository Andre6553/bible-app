import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://fikjnvkzhemamtlwsrin.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpa2pudmt6aGVtYW10bHdzcmluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1MjI3NTIsImV4cCI6MjA4MTA5ODc1Mn0.WdMBr3RCE8xLBugCeleMiTI6-lyZxhvf3LcFRo1D3q8';

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function getBooks() {
    try {
        const { data, error } = await supabase
            .from('books')
            .select('id, name_full, order')
            .order('order');

        if (error) {
            console.error('Error:', error.message);
            return;
        }

        console.log('ID | Order | Name');
        console.log('---|-------|-----');
        data.forEach(b => {
            console.log(`${b.id.toString().padEnd(2)} | ${b.order.toString().padEnd(5)} | ${b.name_full}`);
        });
    } catch (e) {
        console.error('Execution error:', e.message);
    }
}

getBooks();
