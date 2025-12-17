/**
 * Bible XML to SQL Generator (Chunked Version)
 * Generates SQL INSERT statements in smaller chunks for Supabase SQL Editor
 * 
 * Usage: node generate_bible_sql.js
 */

import fs from 'fs';
import path from 'path';
import { XMLParser } from 'fast-xml-parser';

// Bible versions to convert
const VERSIONS_TO_IMPORT = [
    { file: 'EnglishNLTBible.xml', id: 'NLT' },
    { file: 'Afrikaans1983Bible.xml', id: 'AFR83' },
    { file: 'AfrikaansNLVBible.xml', id: 'AFRNLV' },
    { file: 'Xhosa2022Bible.xml', id: 'XHO22' },
];

// Book number (from XML) to DB book_id mapping
// Based on actual books table: order -> id
const BOOK_MAPPING = {
    // Old Testament (order 1-39)
    1: 1,   // Genesis
    2: 2,   // Exodus
    3: 3,   // Leviticus
    4: 4,   // Numbers
    5: 5,   // Deuteronomy
    6: 10,  // Joshua
    7: 11,  // Judges
    8: 12,  // Ruth
    9: 13,  // 1 Samuel
    10: 14, // 2 Samuel
    11: 15, // 1 Kings
    12: 16, // 2 Kings
    13: 17, // 1 Chronicles
    14: 18, // 2 Chronicles
    15: 19, // Ezra
    16: 20, // Nehemiah
    17: 21, // Esther
    18: 22, // Job
    19: 23, // Psalms
    20: 24, // Proverbs
    21: 25, // Ecclesiastes
    22: 26, // Song of Solomon
    23: 27, // Isaiah
    24: 28, // Jeremiah
    25: 29, // Lamentations
    26: 30, // Ezekiel
    27: 31, // Daniel
    28: 32, // Hosea
    29: 33, // Joel
    30: 34, // Amos
    31: 35, // Obadiah
    32: 36, // Jonah
    33: 37, // Micah
    34: 38, // Nahum
    35: 39, // Habakkuk
    36: 40, // Zephaniah
    37: 41, // Haggai
    38: 42, // Zechariah
    39: 43, // Malachi
    // New Testament (order 40-66)
    40: 44, // Matthew
    41: 45, // Mark
    42: 46, // Luke
    43: 6,  // John
    44: 7,  // Acts
    45: 8,  // Romans
    46: 47, // 1 Corinthians
    47: 48, // 2 Corinthians
    48: 49, // Galatians
    49: 50, // Ephesians
    50: 51, // Philippians
    51: 52, // Colossians
    52: 53, // 1 Thessalonians
    53: 54, // 2 Thessalonians
    54: 55, // 1 Timothy
    55: 56, // 2 Timothy
    56: 57, // Titus
    57: 58, // Philemon
    58: 59, // Hebrews
    59: 60, // James
    60: 61, // 1 Peter
    61: 62, // 2 Peter
    62: 63, // 1 John
    63: 64, // 2 John
    64: 65, // 3 John
    65: 66, // Jude
    66: 67  // Revelation
};

const XML_DIR = './Bible Versions/Holy-Bible-XML-Format-master';
const OUTPUT_DIR = './sql_imports';
const VERSES_PER_FILE = 3000; // Small enough for Supabase SQL Editor

function escapeSQL(text) {
    if (!text) return '';
    return text.replace(/'/g, "''");
}

function generateVersionSQL(versionConfig) {
    const xmlPath = path.join(XML_DIR, versionConfig.file);

    console.log(`\n📖 Processing ${versionConfig.id}...`);

    if (!fs.existsSync(xmlPath)) {
        console.error(`   ❌ File not found: ${xmlPath}`);
        return;
    }

    // Read and parse XML
    const xmlData = fs.readFileSync(xmlPath, 'utf-8');
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_'
    });
    const result = parser.parse(xmlData);

    // Collect all verses first
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
                        text: escapeSQL(verseText.trim()),
                        version: versionConfig.id
                    });
                }
            }
        }
    }

    console.log(`   Found ${allVerses.length} verses`);

    // Split into chunks and write files
    const totalFiles = Math.ceil(allVerses.length / VERSES_PER_FILE);

    for (let i = 0; i < totalFiles; i++) {
        const start = i * VERSES_PER_FILE;
        const end = Math.min(start + VERSES_PER_FILE, allVerses.length);
        const chunk = allVerses.slice(start, end);

        let sql = `-- ${versionConfig.id} Part ${i + 1}/${totalFiles}\n`;
        sql += `-- Verses ${start + 1} to ${end}\n\n`;
        sql += `INSERT INTO verses (book_id, chapter, verse, text, version) VALUES\n`;

        const values = chunk.map(v =>
            `(${v.book_id}, ${v.chapter}, ${v.verse}, '${v.text}', '${v.version}')`
        );
        sql += values.join(',\n') + ';\n';

        const outputPath = path.join(OUTPUT_DIR, `${versionConfig.id}_part${i + 1}.sql`);
        fs.writeFileSync(outputPath, sql, 'utf-8');
        console.log(`   📄 ${outputPath}`);
    }

    console.log(`   ✅ Created ${totalFiles} files`);
}

function main() {
    console.log('🚀 Bible SQL Generator (Chunked)');
    console.log('='.repeat(50));

    // Create output directory
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Clean old files
    const oldFiles = fs.readdirSync(OUTPUT_DIR);
    oldFiles.forEach(f => fs.unlinkSync(path.join(OUTPUT_DIR, f)));

    for (const version of VERSIONS_TO_IMPORT) {
        try {
            generateVersionSQL(version);
        } catch (error) {
            console.error(`\n❌ Error: ${version.id}:`, error.message);
        }
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ Done! Import files one by one in Supabase SQL Editor');
}

main();
