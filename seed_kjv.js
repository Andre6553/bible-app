import { createClient } from '@supabase/supabase-js';

// Configuration
const SUPABASE_URL = 'https://fikjnvkzhemamtlwsrin.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpa2pudmt6aGVtYW10bHdzcmluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTUyMjc1MiwiZXhwIjoyMDgxMDk4NzUyfQ.BTrA9ojgOqXG8lUgvZX4aF9uqd3ShX2oGSLu4-8gnW4';
const KJV_JSON_URL = 'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_kjv.json';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const BOOKS_DATA = [
    { name: "Genesis", abbrev: "Gen", testament: "OT", order: 1 },
    { name: "Exodus", abbrev: "Exo", testament: "OT", order: 2 },
    { name: "Leviticus", abbrev: "Lev", testament: "OT", order: 3 },
    { name: "Numbers", abbrev: "Num", testament: "OT", order: 4 },
    { name: "Deuteronomy", abbrev: "Deu", testament: "OT", order: 5 },
    { name: "Joshua", abbrev: "Jos", testament: "OT", order: 6 },
    { name: "Judges", abbrev: "Jxg", testament: "OT", order: 7 },
    { name: "Ruth", abbrev: "Rut", testament: "OT", order: 8 },
    { name: "1 Samuel", abbrev: "1Sa", testament: "OT", order: 9 },
    { name: "2 Samuel", abbrev: "2Sa", testament: "OT", order: 10 },
    { name: "1 Kings", abbrev: "1Ki", testament: "OT", order: 11 },
    { name: "2 Kings", abbrev: "2Ki", testament: "OT", order: 12 },
    { name: "1 Chronicles", abbrev: "1Ch", testament: "OT", order: 13 },
    { name: "2 Chronicles", abbrev: "2Ch", testament: "OT", order: 14 },
    { name: "Ezra", abbrev: "Ezr", testament: "OT", order: 15 },
    { name: "Nehemiah", abbrev: "Neh", testament: "OT", order: 16 },
    { name: "Esther", abbrev: "Est", testament: "OT", order: 17 },
    { name: "Job", abbrev: "Job", testament: "OT", order: 18 },
    { name: "Psalms", abbrev: "Psa", testament: "OT", order: 19 },
    { name: "Proverbs", abbrev: "Pro", testament: "OT", order: 20 },
    { name: "Ecclesiastes", abbrev: "Ecc", testament: "OT", order: 21 },
    { name: "Song of Solomon", abbrev: "Sng", testament: "OT", order: 22 },
    { name: "Isaiah", abbrev: "Isa", testament: "OT", order: 23 },
    { name: "Jeremiah", abbrev: "Jer", testament: "OT", order: 24 },
    { name: "Lamentations", abbrev: "Lam", testament: "OT", order: 25 },
    { name: "Ezekiel", abbrev: "Ezk", testament: "OT", order: 26 },
    { name: "Daniel", abbrev: "Dan", testament: "OT", order: 27 },
    { name: "Hosea", abbrev: "Hos", testament: "OT", order: 28 },
    { name: "Joel", abbrev: "Jol", testament: "OT", order: 29 },
    { name: "Amos", abbrev: "Amo", testament: "OT", order: 30 },
    { name: "Obadiah", abbrev: "Oba", testament: "OT", order: 31 },
    { name: "Jonah", abbrev: "Jon", testament: "OT", order: 32 },
    { name: "Micah", abbrev: "Mic", testament: "OT", order: 33 },
    { name: "Nahum", abbrev: "Nam", testament: "OT", order: 34 },
    { name: "Habakkuk", abbrev: "Hab", testament: "OT", order: 35 },
    { name: "Zephaniah", abbrev: "Zep", testament: "OT", order: 36 },
    { name: "Haggai", abbrev: "Hag", testament: "OT", order: 37 },
    { name: "Zechariah", abbrev: "Zec", testament: "OT", order: 38 },
    { name: "Malachi", abbrev: "Mal", testament: "OT", order: 39 },
    { name: "Matthew", abbrev: "Mat", testament: "NT", order: 40 },
    { name: "Mark", abbrev: "Mrk", testament: "NT", order: 41 },
    { name: "Luke", abbrev: "Luk", testament: "NT", order: 42 },
    { name: "John", abbrev: "Jhn", testament: "NT", order: 43 },
    { name: "Acts", abbrev: "Act", testament: "NT", order: 44 },
    { name: "Romans", abbrev: "Rom", testament: "NT", order: 45 },
    { name: "1 Corinthians", abbrev: "1Co", testament: "NT", order: 46 },
    { name: "2 Corinthians", abbrev: "2Co", testament: "NT", order: 47 },
    { name: "Galatians", abbrev: "Gal", testament: "NT", order: 48 },
    { name: "Ephesians", abbrev: "Eph", testament: "NT", order: 49 },
    { name: "Philippians", abbrev: "Php", testament: "NT", order: 50 },
    { name: "Colossians", abbrev: "Col", testament: "NT", order: 51 },
    { name: "1 Thessalonians", abbrev: "1Th", testament: "NT", order: 52 },
    { name: "2 Thessalonians", abbrev: "2Th", testament: "NT", order: 53 },
    { name: "1 Timothy", abbrev: "1Ti", testament: "NT", order: 54 },
    { name: "2 Timothy", abbrev: "2Ti", testament: "NT", order: 55 },
    { name: "Titus", abbrev: "Tit", testament: "NT", order: 56 },
    { name: "Philemon", abbrev: "Phm", testament: "NT", order: 57 },
    { name: "Hebrews", abbrev: "Heb", testament: "NT", order: 58 },
    { name: "James", abbrev: "Jas", testament: "NT", order: 59 },
    { name: "1 Peter", abbrev: "1Pe", testament: "NT", order: 60 },
    { name: "2 Peter", abbrev: "2Pe", testament: "NT", order: 61 },
    { name: "1 John", abbrev: "1Jn", testament: "NT", order: 62 },
    { name: "2 John", abbrev: "2Jn", testament: "NT", order: 63 },
    { name: "3 John", abbrev: "3Jn", testament: "NT", order: 64 },
    { name: "Jude", abbrev: "Jud", testament: "NT", order: 65 },
    { name: "Revelation", abbrev: "Rev", testament: "NT", order: 66 }
];

async function seed() {
    console.log("Starting KJV Seed...");

    // 1. Sync Books (No constraint needed strategy)
    console.log("Syncing Books...");

    // Fetch existing
    const { data: existingBooks, error: fetchError } = await supabase
        .from('books')
        .select('id, name_full');

    if (fetchError) {
        console.log("Error fetching books (might be empty, continuing...)", fetchError);
    }

    const existingMap = {};
    if (existingBooks) {
        existingBooks.forEach(b => existingMap[b.name_full] = b.id);
    }

    // Determine missing
    const booksToInsert = BOOKS_DATA.filter(b => !existingMap[b.name]).map(b => ({
        name_full: b.name,
        name_abbrev: b.abbrev,
        testament: b.testament,
        order: b.order
    }));

    if (booksToInsert.length > 0) {
        console.log(`Inserting ${booksToInsert.length} new books...`);
        const { data: newBooks, error: insertError } = await supabase
            .from('books')
            .insert(booksToInsert)
            .select();

        if (insertError) {
            console.error("Error inserting books:", insertError);
            return;
        }
        // Add new ones to map
        newBooks.forEach(b => existingMap[b.name_full] = b.id);
    } else {
        console.log("All books already exist.");
    }

    // Create Book Name to ID map
    const bookMap = existingMap;

    // 2. Fetch KJV JSON
    console.log("Fetching KJV JSON...");
    const response = await fetch(KJV_JSON_URL);
    if (!response.ok) {
        console.error("Failed to fetch JSON:", response.statusText);
        return;
    }
    const kjvData = await response.json();
    // Expected structure: [ { name: "Genesis", chapters: [ [ "In the beginning...", ... ] ] } ]

    // 3. Prepare Verses
    console.log("Preparing Verses...");
    let verseCount = 0;
    const BATCH_SIZE = 1000;
    let verseBatch = [];

    for (const book of kjvData) {
        const bookId = bookMap[book.name];
        if (!bookId) {
            console.warn(`Book not found in map: ${book.name}`);
            continue;
        }

        book.chapters.forEach((chapter, chapterIndex) => {
            const chapterNum = chapterIndex + 1;
            chapter.forEach((text, verseIndex) => {
                const verseNum = verseIndex + 1;

                verseBatch.push({
                    book_id: bookId,
                    chapter: chapterNum,
                    verse: verseNum,
                    text: text,
                    version: 'KJV'
                });

                if (verseBatch.length >= BATCH_SIZE) {
                    // Send batch
                    // console.log(`Sending batch of ${verseBatch.length} verses...`);
                    // Note: We can't use await here nicely without wrapping in async function or ignoring specific batch errors
                    // But actually we are in async seed().
                }
            });
        });
    }

    // 4. Send Batches
    console.log(`Total verses to insert: ${verseBatch.length}`);

    // Clear existing KJV to avoid duplicates? Or upsert?
    // Use simple insert but might fail on constraints if they exist. 
    // Let's assume we want to purely Add.
    // Ideally delete where version = 'KJV' first to be clean.
    console.log("Clearing existing KJV verses...");
    await supabase.from('verses').delete().eq('version', 'KJV');

    for (let i = 0; i < verseBatch.length; i += BATCH_SIZE) {
        const batch = verseBatch.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from('verses').insert(batch);
        if (error) {
            console.error(`Error inserting batch ${i}:`, error);
        } else {
            console.log(`Inserted verses ${i} to ${i + batch.length}`);
        }
    }

    console.log("Seeding Complete!");
}

seed();
