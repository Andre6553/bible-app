/**
 * Import NKJV Bible
 */

import fs from 'fs';
import { XMLParser } from 'fast-xml-parser';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://fikjnvkzhemamtlwsrin.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpa2pudmt6aGVtYW10bHdzcmluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTUyMjc1MiwiZXhwIjoyMDgxMDk4NzUyfQ.BTrA9ojgOqXG8lUgvZX4aF9uqd3ShX2oGSLu4-8gnW4'
);

const BOOK_MAPPING = {
    1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 10, 7: 11, 8: 12, 9: 13, 10: 14,
    11: 15, 12: 16, 13: 17, 14: 18, 15: 19, 16: 20, 17: 21, 18: 22, 19: 23, 20: 24,
    21: 25, 22: 26, 23: 27, 24: 28, 25: 29, 26: 30, 27: 31, 28: 32, 29: 33, 30: 34,
    31: 35, 32: 36, 33: 37, 34: 38, 35: 39, 36: 40, 37: 41, 38: 42, 39: 43,
    40: 44, 41: 45, 42: 46, 43: 6, 44: 7, 45: 8, 46: 47, 47: 48, 48: 49, 49: 50,
    50: 51, 51: 52, 52: 53, 53: 54, 54: 55, 55: 56, 56: 57, 57: 58, 58: 59, 59: 60,
    60: 61, 61: 62, 62: 63, 63: 64, 64: 65, 65: 66, 66: 67
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
    console.log('📖 Importing New King James Version (NKJV)...');

    // Clear existing
    console.log('🗑️ Clearing existing NKJV verses...');
    await supabase.from('verses').delete().eq('version', 'NKJV');

    // Parse XML
    console.log('📄 Parsing XML...');
    const xmlData = fs.readFileSync('./Bible Versions/Holy-Bible-XML-Format-master/EnglishNKJBible.xml', 'utf-8');
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
    const result = parser.parse(xmlData);

    // Collect verses
    const allVerses = [];
    const testaments = Array.isArray(result.bible.testament) ? result.bible.testament : [result.bible.testament];

    for (const testament of testaments) {
        if (!testament?.book) continue;
        for (const book of Array.isArray(testament.book) ? testament.book : [testament.book]) {
            const dbBookId = BOOK_MAPPING[parseInt(book['@_number'])];
            if (!dbBookId) continue;
            for (const chapter of Array.isArray(book.chapter) ? book.chapter : [book.chapter]) {
                if (!chapter?.verse) continue;
                for (const verse of Array.isArray(chapter.verse) ? chapter.verse : [chapter.verse]) {
                    const text = typeof verse === 'object' ? verse['#text'] : verse;
                    if (text) allVerses.push({
                        book_id: dbBookId,
                        chapter: parseInt(chapter['@_number']),
                        verse: parseInt(verse['@_number']),
                        text: text.trim(),
                        version: 'NKJV'
                    });
                }
            }
        }
    }

    console.log(`📊 Found ${allVerses.length} verses`);

    // Insert
    let inserted = 0;
    for (let i = 0; i < allVerses.length; i += 500) {
        const { error } = await supabase.from('verses').insert(allVerses.slice(i, i + 500));
        if (!error) inserted += Math.min(500, allVerses.length - i);
        process.stdout.write(`\r📝 Progress: ${inserted}/${allVerses.length} (${Math.round(inserted / allVerses.length * 100)}%)`);
        await sleep(200);
    }

    console.log(`\n✅ Done: ${inserted} verses imported!`);
}

main().catch(console.error);
