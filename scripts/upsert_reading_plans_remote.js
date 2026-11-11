/**
 * Upsert reading plans to Omni Bible Supabase (service role in .env).
 * Use for new/changed plans without sending the full 18MB seed file.
 *
 *   node scripts/upsert_reading_plans_remote.js
 *   node scripts/upsert_reading_plans_remote.js jonah-4 philippians-4
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PLAN_STUDY_GUIDES } from './planCommentary.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv() {
    const envPath = path.resolve(__dirname, '../.env');
    const out = {};
    if (!fs.existsSync(envPath)) return out;
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
        const t = line.trim();
        if (!t || t.startsWith('#')) continue;
        const i = t.indexOf('=');
        if (i > 0) out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
    }
    return out;
}

// Must match generate_reading_plans_seed.js PLAN_META
const PLAN_META = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'plan_catalog_meta.json'), 'utf8')
);

const schedules = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'generated_reading_schedules.json'), 'utf8')
);

const slugArgs = process.argv.slice(2);
const slugsToRun = slugArgs.length > 0 ? slugArgs : Object.keys(PLAN_META).filter((s) => schedules[s]);

async function main() {
    const env = loadEnv();
    const url = env.VITE_SUPABASE_URL;
    const key = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in Bible/.env');
        process.exit(1);
    }

    const supabase = createClient(url, key);
    let ok = 0;
    let fail = 0;

    for (const slug of slugsToRun) {
        const meta = PLAN_META[slug];
        const readings = schedules[slug];
        if (!meta || !readings) {
            console.warn(`Skip ${slug}: missing meta or schedule`);
            fail++;
            continue;
        }

        const study = PLAN_STUDY_GUIDES[slug] || {
            en: 'Each day includes commentary and reflection questions to guide your study alongside the reading.',
            af: 'Elke dag sluit kommentaar en refleksie vrae in om jou studie saam met die leeswerk te begelei.',
        };

        const row = {
            slug,
            title_en: meta.title_en,
            title_af: meta.title_af,
            description_en: meta.description_en,
            description_af: meta.description_af,
            study_guide_en: study.en,
            study_guide_af: study.af,
            duration_days: meta.duration_days,
            category: meta.category,
            readings,
            cover_emoji: meta.cover_emoji,
            sort_order: meta.sort_order,
            is_active: true,
        };

        const { error } = await supabase.from('reading_plans').upsert(row, { onConflict: 'slug' });
        if (error) {
            console.error(`FAIL ${slug}:`, error.message);
            fail++;
        } else {
            console.log(`OK ${slug} (${readings.length} days)`);
            ok++;
        }
    }

    const { count, error: countErr } = await supabase
        .from('reading_plans')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

    if (!countErr) console.log(`Active plans in DB: ${count}`);

    console.log(`Done: ${ok} upserted, ${fail} failed`);
    process.exit(fail ? 1 : 0);
}

main();
