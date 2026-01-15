import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { XMLParser } from 'fast-xml-parser';

// Supabase configuration
const supabaseUrl = 'https://fikjnvkzhemamtlwsrin.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpa2pudmt6aGVtYW10bHdzcmluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1MjI3NTIsImV4cCI6MjA4MTA5ODc1Mn0.WdMBr3RCE8xLBugCeleMiTI6-lyZxhvf3LcFRo1D3q8';
const supabase = createClient(supabaseUrl, supabaseKey);

const XML_PATH = 'Bible versions/Holy-Bible-XML-Format-master/AfrikaansBible.xml';
const MAPPING_PATH = 'book_mapping.json';
const VERSION_ID = 'AFR53';

async function main() {
    try {
        console.log('--- AFR53 Upgrade Process Started ---');

        // 1. Load book mappings
        if (!fs.existsSync(MAPPING_PATH)) {
            throw new Error('book_mapping.json not found. Run fetchBookMapping.js first.');
        }
        const bookMappings = JSON.parse(fs.readFileSync(MAPPING_PATH, 'utf8'));
        const orderToId = {};
        bookMappings.forEach(b => {
            orderToId[b.order] = b.id;
        });

        // 2. Load and CLEAN the XML content
        console.log('Reading and cleaning XML...');
        let xmlContent = fs.readFileSync(XML_PATH, 'utf8');

        // Character replacements for known encoding/formatting issues
        const replacements = [
            { from: /Â k/g, to: 'Ek' },
            { from: /H wila/g, to: 'Havila' },
            { from: /Hidd,kel/g, to: 'Hiddekel' },
            { from: /g,rubs/g, to: 'gerubs' },
            { from: /Na,ma/g, to: 'Naäma' },
            { from: /S¡near/g, to: 'Sinear' },
            { from: /Refa‹ete/g, to: 'Refaïete' },
            { from: /geseënen/g, to: 'geseën en' },
            { from: /m“re/g, to: 'môre' },
            { from: /n“/g, to: 'nó' }, // Often found in 'nóú' or similar
            { from: /v rtoe/g, to: 'vertoe' },
            { from: /Gawila/g, to: 'Gawila' }, // Verify this one, sometimes mangled
        ];

        replacements.forEach(r => {
            xmlContent = xmlContent.replace(r.from, r.to);
        });

        // 3. Parse XML
        console.log('Parsing XML...');
        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: ""
        });
        const jsonObj = parser.parse(xmlContent);

        const testaments = Array.isArray(jsonObj.bible.testament)
            ? jsonObj.bible.testament
            : [jsonObj.bible.testament];

        const allVerses = [];
        let bookCount = 0;

        for (const testament of testaments) {
            const books = Array.isArray(testament.book) ? testament.book : [testament.book];
            for (const book of books) {
                const bookOrder = parseInt(book.number);
                const bookId = orderToId[bookOrder];

                if (!bookId) {
                    console.warn(`Warning: No mapping found for book number ${bookOrder}`);
                    continue;
                }

                bookCount++;
                const chapters = Array.isArray(book.chapter) ? book.chapter : [book.chapter];

                for (const chapter of chapters) {
                    const chapterNum = parseInt(chapter.number);
                    const verses = Array.isArray(chapter.verse) ? chapter.verse : [chapter.verse];

                    for (const verse of verses) {
                        const verseNum = parseInt(verse.number);
                        let text = verse['#text'] || verse;

                        if (typeof text !== 'string') {
                            text = String(text);
                        }

                        // Skip placeholder verses if they are just '***'
                        if (text.trim() === '***') continue;

                        allVerses.push({
                            book_id: bookId,
                            chapter: chapterNum,
                            verse: verseNum,
                            text: text.trim(),
                            version: VERSION_ID
                        });
                    }
                }
            }
        }

        console.log(`Parsed ${allVerses.length} verses across ${bookCount} books.`);

        // 4. Clear old verses
        console.log(`Deleting existing verses for ${VERSION_ID}...`);
        const { error: deleteError } = await supabase
            .from('verses')
            .delete()
            .eq('version', VERSION_ID);

        if (deleteError) throw deleteError;

        // 5. Bulk Upload in chunks
        const CHUNK_SIZE = 1000;
        console.log(`Uploading ${allVerses.length} verses in chunks of ${CHUNK_SIZE}...`);

        for (let i = 0; i < allVerses.length; i += CHUNK_SIZE) {
            const chunk = allVerses.slice(i, i + CHUNK_SIZE);
            const { error: insertError } = await supabase
                .from('verses')
                .insert(chunk);

            if (insertError) {
                console.error(`Error inserting chunk ${i / CHUNK_SIZE + 1}:`, insertError);
                throw insertError;
            }

            if ((i / CHUNK_SIZE) % 5 === 0) {
                console.log(`Uploaded ${i + chunk.length} / ${allVerses.length} verses...`);
            }
        }

        console.log('--- AFR53 Upgrade Process Completed Successfully! ---');

    } catch (err) {
        console.error('Fatal error during upgrade:', err);
    }
}

main();
