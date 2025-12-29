
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env
const supabaseUrl = 'https://fikjnvkzhemamtlwsrin.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpa2pudmt6aGVtYW10bHdzcmluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1MjI3NTIsImV4cCI6MjA4MTA5ODc1Mn0.WdMBr3RCE8xLBugCeleMiTI6-lyZxhvf3LcFRo1D3q8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRPC() {
    console.log("Checking RPC 'get_verse_texts'...");

    const payload = [{
        bookId: '30', // Amos? Exodus? 30 is likely OT.
        chapter: 32,
        verse: 31,
        version: 'AFR83'
    }];

    const { data, error } = await supabase.rpc('get_verse_texts', { requests: payload });

    if (error) {
        console.error("❌ RPC Check Failed:", error.message);
        console.log("Details:", error);
    } else {
        console.log("✅ RPC Check Passed!");
        console.log("Data received:", data);
    }
}

checkRPC();
