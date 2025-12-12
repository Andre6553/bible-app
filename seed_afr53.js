
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import readline from 'readline';

// --- CONFIG ---
const SUPABASE_URL = 'https://fikjnvkzhemamtlwsrin.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpa2pudmt6aGVtYW10bHdzcmluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTUyMjc1MiwiZXhwIjoyMDgxMDk4NzUyfQ.BTrA9ojgOqXG8lUgvZX4aF9uqd3ShX2oGSLu4-8gnW4';

const XML_FILE_PATH = './afr53.xml.xml';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function seed() {
    console.log("Starting AFR53 Seeding (Name Matching)...");

    // 0. CLEAR EXISTING AFR53 DATA
    console.log("Clearing existing AFR53 verses...");
    const { error: delError } = await supabase
        .from('verses')
        .delete()
        .eq('version', 'AFR53');

    if (delError) {
        console.error("Error clearing verses:", delError);
        return;
    }
    console.log("Cleared old data.");

    // 1. Fetch existing books
    console.log("Fetching existing books map...");
    const { data: books, error: booksError } = await supabase
        .from('books')
        .select('id, name_full');

    if (booksError) {
        console.error("Error fetching books:", booksError);
        return;
    }

    function normalize(name) {
        return name.toUpperCase()
            .replace(/^I\s/, '1 ')
            .replace(/^II\s/, '2 ')
            .replace(/^III\s/, '3 ')
            .replace('SONG OF SOLOMON', 'SONG OF SOLOMON')
            .trim();
    }

    const bookNameMap = {};
    books.forEach(b => {
        bookNameMap[normalize(b.name_full)] = b.id;
    });

    console.log(`Loaded ${books.length} books for mapping.`);

    // 2. Parse XML
    const fileStream = fs.createReadStream(XML_FILE_PATH);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let currentBookId = null;
    let currentChapter = null;
    let versesBatch = [];
    const BATCH_SIZE = 1000;
    let totalVerses = 0;

    for await (const line of rl) {
        const trimmed = line.trim();

        // <BIBLEBOOK bname="Genesis" ...>
        const bookMatch = trimmed.match(/<BIBLEBOOK.*?bname="(.*?)"/);
        if (bookMatch) {
            const rawName = bookMatch[1];
            const normalizedName = normalize(rawName);

            let matchedId = bookNameMap[normalizedName];

            // Manual fixes for XML vs DB names
            if (!matchedId) {
                if (normalizedName === 'REVELATION OF JOHN') matchedId = bookNameMap['REVELATION'];
                if (normalizedName === 'PSALM') matchedId = bookNameMap['PSALMS'];
            }

            if (matchedId) {
                currentBookId = matchedId;
            } else {
                console.warn(`Warning: Could not map book name '${rawName}' (Norm: ${normalizedName})`);
                currentBookId = null;
            }
            continue;
        }

        // <CHAPTER cnumber="1">
        const chapMatch = trimmed.match(/<CHAPTER.*?cnumber="(\d+)"/);
        if (chapMatch) {
            currentChapter = parseInt(chapMatch[1], 10);
            continue;
        }

        // <VERS vnumber="1">...</VERS>
        const versMatch = trimmed.match(/<VERS.*?vnumber="(\d+)">(.*?)<\/VERS>/);
        if (versMatch && currentBookId && currentChapter) {
            const verseNum = parseInt(versMatch[1], 10);
            const text = versMatch[2];

            versesBatch.push({
                book_id: currentBookId,
                chapter: currentChapter,
                verse: verseNum,
                text: text,
                version: 'AFR53'
            });
            totalVerses++;

            if (versesBatch.length >= BATCH_SIZE) {
                await insertBatch(versesBatch);
                versesBatch = [];
                process.stdout.write(`\rInserted ${totalVerses} verses...`);
            }
        }
    }

    if (versesBatch.length > 0) {
        await insertBatch(versesBatch);
        console.log(`\rInserted ${totalVerses} verses.`);
    }

    console.log("Seeding Complete!");
}

async function insertBatch(batch) {
    const { error } = await supabase
        .from('verses')
        .insert(batch);

    if (error) {
        console.error("\nError inserting batch:", error);
    }
}

seed().catch(console.error);
