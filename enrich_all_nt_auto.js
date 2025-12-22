import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import fs from 'fs';

const SUPABASE_URL = 'https://fikjnvkzhemamtlwsrin.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpa2pudmt6aGVtYW10bHdzcmluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTUyMjc1MiwiZXhwIjoyMDgxMDk4NzUyfQ.BTrA9ojgOqXG8lUgvZX4aF9uqd3ShX2oGSLu4-8gnW4';

let GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;
if (!GEMINI_API_KEY && fs.existsSync('.env')) {
    const env = fs.readFileSync('.env', 'utf8');
    const match = env.match(/VITE_GEMINI_API_KEY=(.*)/);
    if (match) GEMINI_API_KEY = match[1].trim();
}

if (!GEMINI_API_KEY) {
    console.error('❌ Error: Gemini API Key not found.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function checkConnectivity() {
    try {
        const { error } = await supabase.from('books').select('id').limit(1);
        return !error;
    } catch {
        return false;
    }
}

async function automateNT() {
    console.log('🌟 Global NT Red Letter Enrichment [Resilient Version]');

    const { data: ntBooks, error: bookError } = await supabase
        .from('books').select('id, name_full').eq('testament', 'NT').order('id');

    if (bookError) {
        console.error('❌ Error fetching books:', bookError.message);
        return;
    }

    let consecutiveFailures = 0;

    for (const book of ntBooks) {
        console.log(`\n📘 Book: ${book.name_full}`);

        const { data: chapters, error: chapError } = await supabase
            .from('verses').select('chapter').eq('book_id', book.id);

        if (chapError) {
            console.error(`   ❌ Error fetching chapters: ${chapError.message}`);
            continue;
        }

        const uniqueChapters = [...new Set(chapters.map(c => c.chapter))].sort((a, b) => a - b);

        for (const chapter of uniqueChapters) {
            // Check connectivity
            if (!(await checkConnectivity())) {
                console.warn('   📶 Internet connection lost. Waiting 30s...');
                await new Promise(r => setTimeout(r, 30000));
                if (!(await checkConnectivity())) {
                    console.error('   ❌ Still no connection. Stopping for safety.');
                    process.exit(1);
                }
            }

            const { data: existing } = await supabase
                .from('verses').select('id').eq('book_id', book.id).eq('chapter', chapter)
                .not('red_letters', 'is', null).limit(10);

            if (existing && existing.length >= 10) {
                console.log(`   ⏭️ Chapter ${chapter}: Skipped (Thoroughly enriched).`);
                continue;
            }

            console.log(`   ⚡ Chapter ${chapter}...`);
            try {
                execSync(`node enrich_red_letters.js ${GEMINI_API_KEY} ${book.id} ${chapter}`, { stdio: 'inherit' });
                consecutiveFailures = 0; // Reset on success
                await new Promise(r => setTimeout(r, 4000));
            } catch (e) {
                consecutiveFailures++;
                console.error(`   ❌ Chapter ${chapter} failed.`);
                if (consecutiveFailures >= 5) {
                    console.error('   🛑 5 consecutive failures. Stopping script.');
                    process.exit(1);
                }
                await new Promise(r => setTimeout(r, 10000));
            }
        }
    }
    console.log('\n🏆 ALL DONE!');
}

automateNT();
