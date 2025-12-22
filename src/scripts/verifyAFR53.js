import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fikjnvkzhemamtlwsrin.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpa2pudmt6aGVtYW10bHdzcmluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1MjI3NTIsImV4cCI6MjA4MTA5ODc1Mn0.WdMBr3RCE8xLBugCeleMiTI6-lyZxhvf3LcFRo1D3q8';
const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyUpgrade() {
    console.log('Verifying AFR53 upgrade...');

    // Check problematic verses identified in the report
    const checks = [
        { bookName: 'Genesis', chapter: 1, verse: 1 },
        { bookName: 'Genesis', chapter: 2, verse: 11 }, // Havila
        { bookName: 'Genesis', chapter: 12, verse: 13 }, // suster
        { bookName: 'Genesis', chapter: 14, verse: 5 }, // Sinear
    ];

    for (const check of checks) {
        // Find book ID first
        const { data: book } = await supabase
            .from('books')
            .select('id')
            .eq('name_full', check.bookName)
            .single();

        if (!book) {
            console.error(`Book ${check.bookName} not found`);
            continue;
        }

        const { data: verse, error } = await supabase
            .from('verses')
            .select('text')
            .eq('book_id', book.id)
            .eq('chapter', check.chapter)
            .eq('verse', check.verse)
            .eq('version', 'AFR53')
            .single();

        if (error) {
            console.error(`Error fetching Gen ${check.chapter}:${check.verse}:`, error);
        } else {
            console.log(`${check.bookName} ${check.chapter}:${check.verse}: "${verse.text}"`);
        }
    }

    // Check for any remaining common artifacts
    const { data: badVerses } = await supabase
        .from('verses')
        .select('text')
        .eq('version', 'AFR53')
        .or('text.ilike.%Â k%,text.ilike.%H wila%,text.ilike.%S¡near%')
        .limit(5);

    if (badVerses && badVerses.length > 0) {
        console.warn('Potential issues found in verses:', badVerses);
    } else {
        console.log('No common artifacts found in a sample check.');
    }
}

verifyUpgrade();
