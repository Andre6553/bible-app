
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fikjnvkzhemamtlwsrin.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpa2pudmt6aGVtYW10bHdzcmluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1MjI3NTIsImV4cCI6MjA4MTA5ODc1Mn0.WdMBr3RCE8xLBugCeleMiTI6-lyZxhvf3LcFRo1D3q8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTypes() {
    const tables = ['bible_reading_logs', 'search_logs', 'ai_questions', 'user_profiles', 'user_devotionals', 'devotional_history'];

    console.log("Checking user_id column types...");

    for (const table of tables) {
        try {
            const { data, error } = await supabase
                .from(table)
                .select('user_id')
                .limit(1);

            if (error) {
                console.log(`Table ${table}: Error - ${error.message} (${error.code})`);
            } else if (data && data.length > 0) {
                const val = data[0].user_id;
                console.log(`Table ${table}: Sample user_id = ${val} (Type: ${typeof val})`);
                // Try to check if it's a UUID by checking length or format
                const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
                console.log(`  Looks like UUID: ${isUuid}`);
            } else {
                console.log(`Table ${table}: No data to check type.`);
            }
        } catch (e) {
            console.log(`Table ${table}: Exception - ${e.message}`);
        }
    }
}

checkTypes();
