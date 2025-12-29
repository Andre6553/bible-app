
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load usage credentials directly
const configPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'src', 'config', 'supabaseClient.js');
const configContent = fs.readFileSync(configPath, 'utf8');
const keyMatch = configContent.match(/supabaseKey\s*=\s*['"]([^'"]+)['"]/);
const urlMatch = configContent.match(/supabaseUrl\s*=\s*['"]([^'"]+)['"]/);

if (!keyMatch || !urlMatch) {
    console.error("Could not find Supabase credentials.");
    process.exit(1);
}

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function cleanupOrphans() {
    console.log("🧹 Cleaning up Orphan Highlights...");

    // Target user
    const TARGET_USER_ID = '2f75e157-3371-4137-bd1a-bfce763a2ca6'; // Hardcoded for this session

    // We want to delete highlights where category_id IS NULL for this user
    // or specifically the "Groen" color if we knew it, but "Other Highlights" = orphan.

    // First, verify what we are about to delete
    const { data: orphans, error: fetchError } = await supabase
        .from('verse_highlights')
        .select('id, color, book_id, chapter, verse')
        .eq('user_id', TARGET_USER_ID)
        .is('category_id', null);

    if (fetchError) {
        console.error("Error fetching orphans:", fetchError);
        return;
    }

    if (orphans.length === 0) {
        console.log("No orphan highlights found to clean up.");
        return;
    }

    console.log(`Found ${orphans.length} orphan highlights.`);

    // Ask for manual confirmation if interactive, but here we assume permissions given.
    // Deleting...

    const idsToDelete = orphans.map(h => h.id);

    const { error: deleteError, count } = await supabase
        .from('verse_highlights')
        .delete({ count: 'exact' })
        .in('id', idsToDelete);

    if (deleteError) {
        console.error("Error deleting orphans:", deleteError);
    } else {
        console.log(`Successfully deleted ${count} orphan highlights.`);
    }
}

cleanupOrphans();
