import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://fikjnvkzhemamtlwsrin.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpa2pudmt6aGVtYW10bHdzcmluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTUyMjc1MiwiZXhwIjoyMDgxMDk4NzUyfQ.BTrA9ojgOqXG8lUgvZX4aF9uqd3ShX2oGSLu4-8gnW4';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function testWrite() {
    console.log('Testing write access...');
    const testVerse = {
        book_id: 1, // Genesis
        chapter: 1,
        verse: 999, // dummy verse
        text: 'TEST_ADMIN_WRITE',
        version: 'TEST'
    };

    const { data, error } = await supabase
        .from('verses')
        .insert(testVerse);

    if (error) {
        console.error('❌ Write failed:', error.message);
    } else {
        console.log('✅ Write successful!');

        // Clean up
        await supabase.from('verses').delete().eq('version', 'TEST');
        console.log('✅ Cleanup successful!');
    }
}

testWrite();
