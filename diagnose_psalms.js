
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://fikjnvkzhemamtlwsrin.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpa2pudmt6aGVtYW10bHdzcmluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTUyMjc1MiwiZXhwIjoyMDgxMDk4NzUyfQ.BTrA9ojgOqXG8lUgvZX4aF9uqd3ShX2oGSLu4-8gnW4';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function diagnose() {
    console.log("--- Diagnosing Psalms ---");

    // 1. Get Psalms Book ID
    const { data: book, error: bookError } = await supabase
        .from('books')
        .select('*')
        .ilike('name_full', '%Psalm%')
        .single();

    if (bookError) {
        console.error("Book Error:", bookError);
        return;
    }
    console.log("Psalms Book Data:", book);

    // 2. Count Verses for Psalms in AFR53
    const { count, error: countError } = await supabase
        .from('verses')
        .select('*', { count: 'exact', head: true })
        .eq('book_id', book.id)
        .eq('version', 'AFR53');

    console.log(`Verses found for Psalms (ID: ${book.id}) in AFR53: ${count}`);

    // 3. Check a sample verse if count is 0
    if (count === 0) {
        console.log("Checking if any verses exist for AFR53 at all...");
        const { count: total, error: tErr } = await supabase
            .from('verses')
            .select('*', { count: 'exact', head: true })
            .eq('version', 'AFR53');
        console.log(`Total AFR53 Verses in DB: ${total}`);
    }
}

diagnose().catch(console.error);
