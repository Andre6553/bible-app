import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from "@google/generative-ai";

// --- CONFIGURATION ---
const SUPABASE_URL = 'https://fikjnvkzhemamtlwsrin.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpa2pudmt6aGVtYW10bHdzcmluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTUyMjc1MiwiZXhwIjoyMDgxMDk4NzUyfQ.BTrA9ojgOqXG8lUgvZX4aF9uqd3ShX2oGSLu4-8gnW4';
const GEMINI_API_KEY = process.argv[2];

if (!GEMINI_API_KEY) {
    console.error('❌ Error: Please provide your Gemini API Key as an argument.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: { responseMimeType: "application/json" }
});

// Helper for retries
async function retry(fn, retries = 3, delay = 2000) {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error) {
            const isNetworkError = error.message.includes('fetch failed') || error.message.includes('ECONNRESET');
            if (i === retries - 1 || !isNetworkError) throw error;
            console.warn(`   ⚠️ Retry ${i + 1}/${retries} after error: ${error.message}`);
            await new Promise(r => setTimeout(r, delay * Math.pow(2, i)));
        }
    }
}

async function enrichChapter(bookId, chapter) {
    console.log(`🚀 Red Letter: Book ${bookId}, Chapter ${chapter}`);

    // Fetch verses with retry
    const { data: verses, error } = await retry(() =>
        supabase.from('verses').select('id, verse, text, version')
            .eq('book_id', bookId).eq('chapter', chapter).order('verse')
    );

    if (error) {
        throw new Error(`Database error: ${error.message}`);
    }

    if (!verses || verses.length === 0) {
        console.log('   ℹ️ No verses found.');
        return;
    }

    const versions = [...new Set(verses.map(v => v.version))];

    for (const version of versions) {
        const versionVerses = verses.filter(v => v.version === version);
        console.log(`\n📖 Processing ${version}...`);

        const prompt = `
            You are a strict Bible scholar. I will provide verses from ${version}.
            Identify EXACT word ranges where Jesus (or God speaking directly) is talking.
            1. DO NOT CHANGE WORDS. Indices must match provided text.
            2. BE CONSERVATIVE: If ambiguous, do NOT mark.
            3. Return { "mapping": [{ "id": "uuid", "ranges": [{ "start": 0, "end": 10 }] }] }
            Verses:
            ${versionVerses.map(v => `ID:${v.id} | Verse ${v.verse}: ${v.text}`).join('\n')}
        `;

        try {
            const result = await retry(() => model.generateContent(prompt));
            const responseText = result.response.text();
            const data = JSON.parse(responseText.replace(/```json/g, '').replace(/```/g, '').trim());

            console.log(`   ✅ Tagged ${data.mapping.filter(m => m.ranges.length > 0).length} verses.`);

            for (const item of data.mapping) {
                await retry(() =>
                    supabase.from('verses').update({ red_letters: JSON.stringify(item.ranges) }).eq('id', item.id)
                );
            }
        } catch (e) {
            console.error(`   ❌ Failed ${version}: ${e.message}`);
        }
    }
}

const targetBook = parseInt(process.argv[3]) || 6;
const targetChapter = parseInt(process.argv[4]) || 3;

enrichChapter(targetBook, targetChapter).then(() => {
    console.log('🏁 Done.');
}).catch(err => {
    console.error(`❌ Critical failure: ${err.message}`);
    process.exit(1);
});
