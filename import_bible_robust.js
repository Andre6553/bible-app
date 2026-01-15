import fs from 'fs';
import path from 'path';
import { XMLParser } from 'fast-xml-parser';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://fikjnvkzhemamtlwsrin.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpa2pudmt6aGVtYW10bHdzcmluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTUyMjc1MiwiZXhwIjoyMDgxMDk4NzUyfQ.BTrA9ojgOqXG8lUgvZX4aF9uqd3ShX2oGSLu4-8gnW4';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const VERSIONS_TO_IMPORT = [
    { file: 'EnglishNIVBible.xml', id: 'NIV', name: 'New International Version' },
    { file: 'EnglishESVBible.xml', id: 'ESV', name: 'English Standard Version' },
];

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

const BATCH_SIZE = 200;
const MAX_RETRIES = 5;
const RETRY_DELAY = 2000;
const BATCH_DELAY = 100;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function importWithRetry(batch, batchIndex, totalBatches) {
    let retries = 0;
    while (retries < MAX_RETRIES) {
        try {
            const { error } = await supabase.from('verses').insert(batch);
            if (!error) return true;

            console.error(`\n   ⚠️ Batch ${batchIndex}/${totalBatches} failed (Attempt ${retries + 1}): ${error.message}`);
            retries++;
            if (retries < MAX_RETRIES) await sleep(RETRY_DELAY * retries);
        } catch (e) {
            console.error(`\n   ❌ Batch ${batchIndex}/${totalBatches} exception: ${e.message}`);
            retries++;
            if (retries < MAX_RETRIES) await sleep(RETRY_DELAY * retries);
        }
    }
    return false;
}

async function importVersion(versionConfig) {
    const xmlPath = path.join(XML_DIR, versionConfig.file);
    console.log(`\n📖 Importing ${versionConfig.name}...`);

    if (!fs.existsSync(xmlPath)) {
        console.error(`   ❌ File not found: ${xmlPath}`);
        return;
    }

    console.log('   🗑️ Clearing existing verses for this version...');
    const { error: deleteError } = await supabase
        .from('verses')
        .delete()
        .eq('version', versionConfig.id);

    if (deleteError) {
        console.log('   ⚠️ Delete warning (might be empty):', deleteError.message);
    }

    console.log('   📄 Parsing XML...');
    const xmlData = fs.readFileSync(xmlPath, 'utf-8');
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_'
    });
    const result = parser.parse(xmlData);

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
                    const verseText = typeof verse === 'object' ? verse['#text'] : (typeof verse === 'string' ? verse : '');
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

    const totalVerses = allVerses.length;
    console.log(`   📊 Found ${totalVerses} verses. Starting upload in batches of ${BATCH_SIZE}...`);

    let importedCount = 0;
    let failedBatches = 0;
    const totalBatches = Math.ceil(totalVerses / BATCH_SIZE);

    for (let i = 0; i < totalVerses; i += BATCH_SIZE) {
        const batch = allVerses.slice(i, i + BATCH_SIZE);
        const batchIndex = Math.floor(i / BATCH_SIZE) + 1;

        const success = await importWithRetry(batch, batchIndex, totalBatches);
        if (success) {
            importedCount += batch.length;
        } else {
            failedBatches++;
        }

        process.stdout.write(`\r   📝 Progress: ${importedCount}/${totalVerses} verses (${Math.round((importedCount / totalVerses) * 100)}%)`);
        await sleep(BATCH_DELAY);
    }

    console.log(`\n   ✅ Finished ${versionConfig.id}: ${importedCount} verses imported.`);
    if (failedBatches > 0) {
        console.error(`   🛑 CRITICAL: ${failedBatches} batches failed permanently for ${versionConfig.id}!`);
    }
}

async function main() {
    console.log('🚀 Robust Bible Import');
    console.log('='.repeat(50));

    for (const version of VERSIONS_TO_IMPORT) {
        await importVersion(version);
    }

    console.log('\n' + '='.repeat(50));
    console.log('🏁 All operations finished!');
}

main().catch(console.error);
