import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

// --- Configuration ---
const INPUT_FILE = 'c:\\Users\\User\\Ai Projects\\Bible\\Bible Versions\\Holy-Bible-XML-Format-master\\EnglishESVBible.xml';
const BATCH_SIZE = 500; // Smaller blocks as requested
const DELAY_MS = 500;   // 500ms delay as requested
const VERSION_ID = 'ESV';
const SUPABASE_URL = 'https://fikjnvkzhemamtlwsrin.supabase.co';

// --- Helper: Read .env for Service Role Key ---
function getServiceRoleKey() {
    try {
        const envPath = path.resolve(process.cwd(), '.env');
        const envData = fs.readFileSync(envPath, 'utf8');
        const match = envData.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);
        if (match && match[1]) return match[1].trim();
    } catch (e) { console.error('Error reading .env', e); }
    return null;
}

const serviceKey = getServiceRoleKey();
if (!serviceKey) {
    console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, serviceKey);

// --- Sleep Helper ---
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- Main Migration Function ---
async function startSlowImport() {
    console.log(`🚀 Starting Slow Import (Mapped) for version: ${VERSION_ID}`);
    console.log(`📦 Batch Size: ${BATCH_SIZE}`);
    console.log(`⏱️  Delay: ${DELAY_MS}ms`);

    // 0. Fetch Book Mapping (Order -> ID)
    console.log('🗺️  Fetching Book Mapping from DB...');
    const { data: books, error: mapError } = await supabase
        .from('books')
        .select('id, order, name_full');

    if (mapError) {
        console.error('❌ Error fetching books:', mapError);
        return;
    }

    const orderToId = {};
    books.forEach(b => {
        if (b.order) orderToId[b.order] = b.id;
    });
    console.log(`✅ Loaded ${books.length} books for mapping.`);

    // 1. Double Check Deletion (Optional but safe)
    const { count } = await supabase.from('verses').select('*', { count: 'exact', head: true }).eq('version', VERSION_ID);
    if (count > 0) {
        console.log(`⚠️ Warning: Database still has ${count} ESV verses. Did you delete them? Proceeding anyway (might duplicate).`);
    } else {
        console.log('✅ Confirmed database is clean (0 verses).');
    }

    // 2. Parse XML and Import
    console.log('📖 Reading XML file...');
    const fileStream = fs.createReadStream(INPUT_FILE);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let versesBuffer = [];
    let currentBookOrder = 0;
    let currentChapter = 0;
    let totalInserted = 0;
    let skippedBooks = new Set();
    let batchCount = 0;

    for await (const line of rl) {
        const l = line.trim();

        // <book number="1">
        if (l.startsWith('<book')) {
            const m = l.match(/number="(\d+)"/);
            if (m) currentBookOrder = parseInt(m[1]);
        }

        // <chapter number="1">
        if (l.startsWith('<chapter')) {
            const m = l.match(/number="(\d+)"/);
            if (m) currentChapter = parseInt(m[1]);
        }

        // <verse number="1">Text</verse>
        if (l.startsWith('<verse')) {
            const m = l.match(/number="(\d+)">(.*)<\/verse>/);
            if (m) {
                const verseNum = parseInt(m[1]);
                let text = m[2];
                let mappedBookId = orderToId[currentBookOrder];

                if (!mappedBookId) {
                    if (!skippedBooks.has(currentBookOrder)) {
                        console.warn(`⚠️ Warning: No DB Book ID found for XML Book Order ${currentBookOrder}. Skipping verses.`);
                        skippedBooks.add(currentBookOrder);
                    }
                    continue;
                }

                versesBuffer.push({
                    book_id: mappedBookId, // MAPPED ID
                    chapter: currentChapter,
                    verse: verseNum,
                    text: text, // IMPORT AS IS
                    version: VERSION_ID,
                    red_letters: null
                });

                // Batch Insert
                if (versesBuffer.length >= BATCH_SIZE) {
                    await insertBatch(versesBuffer);
                    totalInserted += versesBuffer.length;
                    versesBuffer = [];
                    batchCount++;
                    process.stdout.write(`\r⏳ Inserted: ${totalInserted} (Batch ${batchCount})`);

                    // SLOW DOWN
                    await sleep(DELAY_MS);
                }
            }
        }
    }

    // Final Batch
    if (versesBuffer.length > 0) {
        await insertBatch(versesBuffer);
        totalInserted += versesBuffer.length;
    }

    console.log(`\n\n🎉 Slow Import Complete! Total verses inserted: ${totalInserted}`);
}

async function insertBatch(batch) {
    const { error } = await supabase.from('verses').insert(batch);
    if (error) {
        console.error('\n❌ Error inserting batch:', error.message);
    }
}

startSlowImport().catch(console.error);
