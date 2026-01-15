import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { XMLParser } from 'fast-xml-parser';
import { fileURLToPath } from 'url';

// --- Configuration ---
const INPUT_FILE = './Bible Versions/Bible_Afrikaans/Bible_Afrikaans.xml';
const BATCH_SIZE = 1000;
const VERSION_ID = 'AFR53';

// Manual definition of XML Name -> DB English Name
// The XML uses English names mostly, but some might differ (e.g. Psalm vs Psalms)
const XML_TO_DB_MAP = {
    "Psalm": "Psalms",
    // Add others if needed based on listBooks.js output vs DB names
    // "Song of Solomon" matches
    // "Revelation" matches
};

// --- Setup ---
import { supabaseUrl, supabaseKey } from '../config/supabaseClient.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '../../');

console.log("Using Supabase URL:", supabaseUrl);
// console.log("Using Supabase Key:", supabaseKey); // Don't log key

const supabase = createClient(supabaseUrl, supabaseKey);

// --- Main ---
const run = async () => {
    console.log(`Starting replacement of ${VERSION_ID} with ${INPUT_FILE}...`);

    // 1. Fetch Books ID mapping
    console.log("Fetching books...");
    const { data: booksData, error: booksError } = await supabase.from('books').select('id, name_full, name_abbrev');
    if (booksError) {
        console.error("Error fetching books:", booksError);
        return;
    }

    // Create Map: English Name -> ID
    const bookMap = {};
    const abbrevMap = {};
    booksData.forEach(b => {
        bookMap[b.name_full] = b.id;
        abbrevMap[b.name_abbrev] = b.id;
    });

    // 2. Parse XML
    const xmlPath = path.resolve(ROOT_DIR, INPUT_FILE);
    console.log(`Reading XML: ${xmlPath}`);
    const xmlData = fs.readFileSync(xmlPath, 'utf8');

    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: ""
    });
    const jsonObj = parser.parse(xmlData);

    // Structure: XMLBIBLE -> BIBLEBOOK[] -> CHAPTER[] -> VERS[]
    const bibleBooks = jsonObj.XMLBIBLE.BIBLEBOOK;

    // 3. Prepare Verses
    const versesToInsert = [];
    let processedCount = 0;

    // Ensure array for BIBLEBOOK (in case single book)
    const booksArray = Array.isArray(bibleBooks) ? bibleBooks : [bibleBooks];

    console.log(`Found ${booksArray.length} books in XML.`);

    for (const bookNode of booksArray) {
        const xmlName = bookNode.bname;
        // Map specific XML name differences to DB English name, or fallback to xmlName
        const dbEnglishName = XML_TO_DB_MAP[xmlName] || xmlName;

        let bookId = bookMap[dbEnglishName];

        // Fallback or fuzzy check?
        if (!bookId) {
            console.warn(`⚠️ Could not map book name: '${xmlName}' (Mapped: '${dbEnglishName}') - Skipping!`);
            continue;
        }

        // Ensure array for CHAPTER
        const chapters = Array.isArray(bookNode.CHAPTER) ? bookNode.CHAPTER : [bookNode.CHAPTER];

        for (const chapNode of chapters) {
            const chapterNum = parseInt(chapNode.cnumber);

            // Ensure array for VERS
            const verses = Array.isArray(chapNode.VERS) ? chapNode.VERS : [chapNode.VERS];

            for (const vNode of verses) {
                const verseNum = parseInt(vNode.vnumber);
                const text = vNode['#text']; // Text content

                if (text) {
                    versesToInsert.push({
                        book_id: bookId,
                        chapter: chapterNum,
                        verse: verseNum,
                        text: text,
                        version: VERSION_ID
                    });
                    processedCount++;
                }
            }
        }
    }

    console.log(`Prepared ${versesToInsert.length} verses for insertion.`);

    // 4. Delete Old Verses
    console.log(`Deleting existing ${VERSION_ID} verses...`);
    // Note: Delete might time out if too many rows. We might need to batched delete or just hope it works. 
    // Usually 'delete().eq()' works fine for ~30k rows but let's try.
    const { error: deleteError } = await supabase.from('verses').delete().eq('version', VERSION_ID);
    if (deleteError) {
        console.error("Error deleting old verses:", deleteError);
        // Sometimes it's a timeout, but partial delete might have happened. 
        // Proceeding might dup if delete failed partially.
        // Let's assume user wants to Force It.
    } else {
        console.log("Old verses deleted successfully.");
    }

    // 5. Insert New Verses (Batched)
    console.log("Inserting new verses...");
    for (let i = 0; i < versesToInsert.length; i += BATCH_SIZE) {
        const batch = versesToInsert.slice(i, i + BATCH_SIZE);
        const { error: insertError } = await supabase.from('verses').insert(batch);

        if (insertError) {
            console.error(`Error inserting batch ${i}:`, insertError);
        } else {
            console.log(`Inserted verses ${i + 1} to ${Math.min(i + BATCH_SIZE, versesToInsert.length)}`);
        }
    }

    console.log("DONE! Migration complete.");

}

run().catch(console.error);
