const { createClient } = require('@supabase/supabase-js');

// Using the anon key found in source code for debug context
const supabaseUrl = 'https://fikjnvkzhemamtlwsrin.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpa2pudmt6aGVtYW10bHdzcmluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1MjI3NTIsImV4cCI6MjA4MTA5ODc1Mn0.WdMBr3RCE8xLBugCeleMiTI6-lyZxhvf3LcFRo1D3q8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log('--- Checking "blessing" ---');

    // Check textSearch for "blessing"
    const { data: textSearch } = await supabase
        .from('strongs_concordance')
        .select('id, lemma, definition')
        .textSearch('definition', `'blessing'`, { config: 'english' })
        .limit(5);
    console.log('1. TextSearch "blessing":', textSearch);

    // Check simple ilike for "blessing"
    const { data: ilike } = await supabase
        .from('strongs_concordance')
        .select('id, lemma, definition')
        .ilike('definition', '%blessing%')
        .limit(5);
    console.log('2. iLike "blessing":', ilike && ilike.length > 0 ? ilike.length + ' matches' : 'No matches');

    // Check "bless" master term candidates
    const { data: bless } = await supabase
        .from('strongs_concordance')
        .select('id, lemma, definition')
        .in('id', ['H1288', 'G2127', 'H1293', 'G2129']) // Common Blessing IDs
    console.log('3. Common Bless/Blessing IDs:', bless);
}

check().catch(console.error);
