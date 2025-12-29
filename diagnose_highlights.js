
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

async function diagnose() {
    console.log("📊 Diagnosing Highlights...");

    // Pick the user (based on previous sessions or hardcoded if we are confident)
    // The user ID saw in debug was: 2f75e157-3371-4137-bd1a-bfce763a2ca6
    const TARGET_USER_ID = '2f75e157-3371-4137-bd1a-bfce763a2ca6';

    const { data: highlights, error } = await supabase
        .from('verse_highlights')
        .select('*')
        .eq('user_id', TARGET_USER_ID);

    if (error) {
        console.error("Error fetching highlights:", error);
        return;
    }

    console.log(`\n--- Highlights for ${TARGET_USER_ID} ---`);
    console.log(`Total Count: ${highlights.length}`);

    // Breakdown by Category ID (orphans vs categorized) and Color
    const breakdown = {};
    highlights.forEach(h => {
        const catStr = h.category_id === null ? "NULL" : h.category_id;
        const key = `Cat: ${catStr} | Color: ${h.color}`;
        breakdown[key] = (breakdown[key] || 0) + 1;
    });

    console.log("\n--- Breakdown ---");
    console.table(breakdown);

    // Check categories too
    const { data: categories } = await supabase
        .from('highlight_categories')
        .select('*')
        .eq('user_id', TARGET_USER_ID);

    console.log("\n--- Categories ---");
    console.table(categories);
}

diagnose();
