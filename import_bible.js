/**
 * Bible Import with Service Role Key
 * Uses admin API access to bypass rate limits
 */

import fs from 'fs';
import path from 'path';
import { XMLParser } from 'fast-xml-parser';
import { createClient } from '@supabase/supabase-js';

// Use SERVICE ROLE key for admin access
const SUPABASE_URL = 'https://fikjnvkzhemamtlwsrin.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpa2pudmt6aGVtYW10bHdzcmluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTUyMjc1MiwiZXhwIjoyMDgxMDk4NzUyfQ.BTrA9ojgOqXG8lUgvZX4aF9uqd3ShX2oGSLu4-8gnW4';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const VERSIONS_TO_IMPORT = [
    { file: 'EnglishNLTBible.xml', id: 'NLT', name: 'New Living Translation' },
    { file: 'Afrikaans1983Bible.xml', id: 'AFR83', name: 'Afrikaans 1983' },
    { file: 'AfrikaansNLVBible.xml', id: 'AFRNLV', name: 'Afrikaans NLV' },
    { file: 'Xhosa2022Bible.xml', id: 'XHO22', name: 'Xhosa 2022' },
];

// Correct book mapping based on actual database IDs
const BOOK_MAPPING = {
    1: 1, 2: 2, 3: 3, 4: 4, 5: 5,
    6: 10, 7: 11, 8: 12, 9: 13, 10: 14,
    11: 15, 12: 16, 13: 17, 14: 18, 15: 19,
    16: 20, 17: 21, 18: 22, 19: 23, 20: 24,
    21: 25, 22: 26, 23: 27, 24: 28, 25: 29,
    26: 30, 27: 31, 28: 32, 29: 33, 30: 34,
    31: 35, 32: 36, 33: 37, 34: 38, 35: 39,
    36: 40, 37: 41, 38: 42, 39: 43,
    40: 44, 41: 45, 42: 46, 43: 6, 44: 7,
    45: 8, 46: 47, 47: 48, 48: 49, 49: 50,
    50: 51, 51: 52, 52: 53, 53: 54, 54: 55,
    55: 56, 56: 57, 57: 58, 58: 59, 59: 60,
    60: 61, 61: 62, 62: 63, 63: 64, 64: 65,
    65: 66, 66: 67
};

const XML_DIR = './Bible Versions/Holy-Bible-XML-Format-master';

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function importVersion(versionConfig) {
    const xmlPath = path.join(XML_DIR, versionConfig.file);

    console.log(`\n📖 Importing ${versionConfig.name}...`);

    if (!fs.existsSync(xmlPath)) {
        console.error(`   ❌ File not found: ${xmlPath}`);
        return;
    }

    // First, delete any existing verses for this version
    console.log('   🗑️ Clearing existing verses...');
    const { error: deleteError } = await supabase
        .from('verses')
        .delete()
        .eq('version', versionConfig.id);

    if (deleteError) {
        console.log('   ⚠️ Delete error:', deleteError.message);
    } else {
        console.log('   ✅ Cleared existing verses');
    }

    // Read and parse XML
    console.log('   📄 Parsing XML...');
    const xmlData = fs.readFileSync(xmlPath, 'utf-8');
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_'
    });
    const result = parser.parse(xmlData);

    // Collect all verses
    const allVerses = [];
    const bible = result.bible;
    const testaments = Array.isArray(bible.testament) ? bible.testament : [bible.testament];

    for (const testament of testaments) {
        if (!testament?.book) continue;
        const books = Array.isArray(testament.book) ? testament.book : [testament.book];

        for (const book of books) {
            const bookNum = parseInt(book['@_number']);
            const dbBookId = BOOK_MAPPING[bookNum];
            if (!dbBookId) continue;

            const chapters = Array.isArray(book.chapter) ? book.chapter : [book.chapter];

            for (const chapter of chapters) {
                if (!chapter?.verse) continue;
                const chapterNum = parseInt(chapter['@_number']);
                const verses = Array.isArray(chapter.verse) ? chapter.verse : [chapter.verse];

                for (const verse of verses) {
                    const verseNum = parseInt(verse['@_number']);
                    const verseText = typeof verse === 'object' ? verse['#text'] : verse;
                    if (!verseText) continue;

                    allVerses.push({
                        book_id: dbBookId,
                        chapter: chapterNum,
                        verse: verseNum,
                        text: verseText.trim(),
                        version: versionConfig.id
                    });
                }
            }
        }
    }

    console.log(`   📊 Found ${allVerses.length} verses`);

    // Insert in larger batches with service role
    const batchSize = 500;
    let inserted = 0;
    let errors = 0;

    for (let i = 0; i < allVerses.length; i += batchSize) {
        const batch = allVerses.slice(i, i + batchSize);

        const { error } = await supabase.from('verses').insert(batch);

        if (error) {
            errors++;
            if (errors <= 3) {
                console.log(`\n   ⚠️ Error at ${i}: ${error.message}`);
            }
        } else {
            inserted += batch.length;
        }

        // Show progress
        process.stdout.write(`\r   📝 Progress: ${inserted}/${allVerses.length} verses (${Math.round(inserted / allVerses.length * 100)}%)`);

        // Small delay between batches
        await sleep(200);
    }

    console.log(`\n   ✅ Completed: ${inserted} verses imported`);
    if (errors > 0) console.log(`   ⚠️ ${errors} batches had errors`);
}

async function main() {
    console.log('🚀 Bible Import (Service Role)');
    console.log('='.repeat(50));

    // Test connection first
    console.log('🔌 Testing connection...');
    const { data, error } = await supabase.from('books').select('id').limit(1);
    if (error) {
        console.error('❌ Connection failed:', error.message);
        return;
    }
    console.log('✅ Connected to Supabase!\n');

    for (const version of VERSIONS_TO_IMPORT) {
        try {
            await importVersion(version);
        } catch (error) {
            console.error(`\n❌ Error importing ${version.name}:`, error.message);
        }
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ All imports complete!');
}

main().catch(console.error);
