
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fikjnvkzhemamtlwsrin.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpa2pudmt6aGVtYW10bHdzcmluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1MjI3NTIsImV4cCI6MjA4MTA5ODc1Mn0.WdMBr3RCE8xLBugCeleMiTI6-lyZxhvf3LcFRo1D3q8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function findGray() {
    console.log("Searching for gray highlights (#64748b or similar)...");

    // We fetch ALL highlights (might be big, but assume <10k for now)
    // Or we can group by color
    const { data: highlights, error } = await supabase
        .from('verse_highlights')
        .select('user_id, color');

    if (error) {
        console.error(error);
        return;
    }

    const colorCounts = {}; // color -> count
    const userColors = {}; // userId -> Set(colors)

    highlights.forEach(h => {
        colorCounts[h.color] = (colorCounts[h.color] || 0) + 1;

        if (!userColors[h.user_id]) userColors[h.user_id] = new Set();
        userColors[h.user_id].add(h.color);
    });

    console.log("\n--- Color Distribution ---");
    // Sort by count
    Object.entries(colorCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([c, count]) => console.log(`${c}: ${count}`));

    console.log("\n--- Users with Gray (#64748b or #9ca3af) ---");
    const grayHexes = ['#64748b', '#9ca3af', '#94a3b8', '#cfd8dc']; // Common grays

    Object.entries(userColors).forEach(([uid, colors]) => {
        const hasGray = [...colors].some(c => grayHexes.some(g => c.toLowerCase() === g.toLowerCase()));
        if (hasGray) {
            console.log(`User ${uid} has GRAY! Colors:`, [...colors]);
        }
    });
}

findGray();
