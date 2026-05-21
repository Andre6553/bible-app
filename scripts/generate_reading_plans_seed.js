/**
 * Generates reading_plans_seed.sql from generated_reading_schedules.json
 * Run: node scripts/generate_reading_plans_seed.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PLAN_STUDY_GUIDES } from './planCommentary.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEDULES_FILE = path.join(__dirname, 'generated_reading_schedules.json');
const OUT_FILE = path.join(__dirname, '..', 'src', 'sql_imports', 'reading_plans_seed.sql');

const PLAN_META = {
    'proverbs-31': {
        title_en: 'Proverbs in 31 Days',
        title_af: 'Spreuke in 31 Dae',
        description_en: 'Read one chapter of Proverbs each day for a month of practical wisdom.',
        description_af: 'Lees een hoofstuk van Spreuke elke dag vir \'n maand van praktiese wysheid.',
        duration_days: 31,
        category: 'devotional',
        cover_emoji: '📜',
        sort_order: 1,
    },
    'psalms-30': {
        title_en: 'Psalms in 30 Days',
        title_af: 'Psalms in 30 Dae',
        description_en: 'Journey through all 150 Psalms in 30 days — praise, lament, and prayer.',
        description_af: 'Reis deur al 150 Psalms in 30 dae — lof, klagte en gebed.',
        duration_days: 30,
        category: 'devotional',
        cover_emoji: '🎵',
        sort_order: 2,
    },
    'gospels-40': {
        title_en: 'Gospels in 40 Days',
        title_af: 'Evangelies in 40 Dae',
        description_en: 'Walk through Matthew, Mark, Luke, and John in 40 days.',
        description_af: 'Loop deur Matteus, Markus, Lukas en Johannes in 40 dae.',
        duration_days: 40,
        category: 'topic',
        cover_emoji: '✝️',
        sort_order: 3,
    },
    'nt-90': {
        title_en: 'New Testament in 90 Days',
        title_af: 'Nuwe Testament in 90 Dae',
        description_en: 'Read the entire New Testament in 90 days — about 3 chapters per day.',
        description_af: 'Lees die hele Nuwe Testament in 90 dae — ongeveer 3 hoofstukke per dag.',
        duration_days: 90,
        category: 'nt',
        cover_emoji: '📖',
        sort_order: 4,
    },
    'bible-365': {
        title_en: 'Bible in a Year',
        title_af: 'Bybel in \'n Jaar',
        description_en: 'Read the entire Bible in 365 days — about 3 chapters per day in canonical order.',
        description_af: 'Lees die hele Bybel in 365 dae — ongeveer 3 hoofstukke per dag in kanonieke volgorde.',
        duration_days: 365,
        category: 'whole_bible',
        cover_emoji: '📚',
        sort_order: 5,
    },
    'ot-180': {
        title_en: 'Old Testament in 180 Days',
        title_af: 'Ou Testament in 180 Dae',
        description_en: 'Journey through Genesis to Malachi in six months — about 5 chapters per day.',
        description_af: 'Reis van Genesis tot Maleagi in ses maande — ongeveer 5 hoofstukke per dag.',
        duration_days: 180,
        category: 'whole_bible',
        cover_emoji: '📜',
        sort_order: 6,
    },
    'paul-30': {
        title_en: "Paul's Letters in 30 Days",
        title_af: 'Paulus se Briewe in 30 Dae',
        description_en: 'Read Romans through Philemon in 30 days — focused study of Paul\'s epistles.',
        description_af: 'Lees Romeine tot Filemon in 30 dae — gefokusde studie van Paulus se briewe.',
        duration_days: 30,
        category: 'nt',
        cover_emoji: '✉️',
        sort_order: 7,
    },
    'revelation-22': {
        title_en: 'Revelation in 22 Days',
        title_af: 'Openbaring in 22 Dae',
        description_en: 'One chapter per day through the final book of the Bible.',
        description_af: 'Een hoofstuk per dag deur die laaste boek van die Bybel.',
        duration_days: 22,
        category: 'nt',
        cover_emoji: '🔮',
        sort_order: 8,
    },
    'romans-16': {
        title_en: 'Romans in 16 Days',
        title_af: 'Romeine in 16 Dae',
        description_en: 'Deep dive through Paul\'s greatest letter — one chapter per day.',
        description_af: 'Diep duik deur Paulus se grootste brief — een hoofstuk per dag.',
        duration_days: 16,
        category: 'nt',
        cover_emoji: '📖',
        sort_order: 9,
    },
    'john-21': {
        title_en: 'Gospel of John in 21 Days',
        title_af: 'Evangelie van Johannes in 21 Dae',
        description_en: 'Walk through John\'s Gospel — ideal for new believers and daily devotion.',
        description_af: 'Loop deur Johannes se Evangelie — ideaal vir nuwe gelowiges en daaglikse toewyding.',
        duration_days: 21,
        category: 'nt',
        cover_emoji: '💙',
        sort_order: 10,
    },
    'parables-20': {
        title_en: 'Parables of Jesus',
        title_af: 'Gelykenisse van Jesus',
        description_en: '20 days exploring the parables of Jesus across the Gospels.',
        description_af: '20 dae om die gelykenisse van Jesus in die Evangelies te verken.',
        duration_days: 20,
        category: 'topic',
        cover_emoji: '🌾',
        sort_order: 11,
    },
    'miracles-14': {
        title_en: 'Miracles of Jesus',
        title_af: 'Wonderwerke van Jesus',
        description_en: '14 days of Jesus\' greatest miracles — healing, nature, and resurrection.',
        description_af: '14 dae van Jesus se grootste wonderwerke — genesing, natuur en opstanding.',
        duration_days: 14,
        category: 'topic',
        cover_emoji: '✨',
        sort_order: 12,
    },
    'faith-hope-21': {
        title_en: 'Faith & Hope',
        title_af: 'Geloof en Hoop',
        description_en: '21 days of Scripture on trusting God and holding onto hope.',
        description_af: '21 dae van Skrif oor vertrou op God en vashou aan hoop.',
        duration_days: 21,
        category: 'topic',
        cover_emoji: '🕊️',
        sort_order: 13,
    },
    'women-bible-30': {
        title_en: 'Women of the Bible',
        title_af: 'Vroue van die Bybel',
        description_en: '30 days exploring the stories of key women throughout Scripture.',
        description_af: '30 dae om die stories van sleutelvroue regdeur die Skrif te verken.',
        duration_days: 30,
        category: 'topic',
        cover_emoji: '👑',
        sort_order: 14,
    },
    'beginner-14': {
        title_en: "Beginner's Bible Overview",
        title_af: 'Beginner se Bybel Oorsig',
        description_en: '14 essential chapters to introduce the major themes of the Bible.',
        description_af: '14 essensiële hoofstukke om die hoof temas van die Bybel bekend te stel.',
        duration_days: 14,
        category: 'topic',
        cover_emoji: '🌱',
        sort_order: 15,
    },
    'family-52': {
        title_en: 'Family Devotions',
        title_af: 'Gesins Toewyding',
        description_en: '52 weekly readings for families — short, child-friendly Bible stories.',
        description_af: '52 weeklikse lesings vir gesinne — kort, kindervriendelike Bybelstories.',
        duration_days: 52,
        category: 'devotional',
        cover_emoji: '👨‍👩‍👧‍👦',
        sort_order: 16,
    },
};

const schedules = JSON.parse(fs.readFileSync(SCHEDULES_FILE, 'utf8'));

const escapeSql = (str) => str.replace(/'/g, "''");

let sql = `-- Reading Plans Seed Data (upsert — preserves user enrollments)
-- Run after reading_plans_schema.sql
-- Generated by scripts/generate_reading_plans_seed.js

`;

for (const [slug, readings] of Object.entries(schedules)) {
    const meta = PLAN_META[slug];
    if (!meta) {
        console.warn(`Warning: no PLAN_META for slug "${slug}", skipping`);
        continue;
    }

    const readingsJson = JSON.stringify(readings).replace(/'/g, "''");

    const studyGuide = PLAN_STUDY_GUIDES[slug] || {
        en: 'Each day includes commentary and reflection questions to guide your study alongside the reading.',
        af: 'Elke dag sluit kommentaar en refleksie vrae in om jou studie saam met die leeswerk te begelei.',
    };

    sql += `INSERT INTO reading_plans (
    slug, title_en, title_af, description_en, description_af,
    study_guide_en, study_guide_af,
    duration_days, category, readings, cover_emoji, sort_order, is_active
) VALUES (
    '${slug}',
    '${escapeSql(meta.title_en)}',
    '${escapeSql(meta.title_af)}',
    '${escapeSql(meta.description_en)}',
    '${escapeSql(meta.description_af)}',
    '${escapeSql(studyGuide.en)}',
    '${escapeSql(studyGuide.af)}',
    ${meta.duration_days},
    '${meta.category}',
    '${readingsJson}'::jsonb,
    '${meta.cover_emoji}',
    ${meta.sort_order},
    true
)
ON CONFLICT (slug) DO UPDATE SET
    title_en = EXCLUDED.title_en,
    title_af = EXCLUDED.title_af,
    description_en = EXCLUDED.description_en,
    description_af = EXCLUDED.description_af,
    study_guide_en = EXCLUDED.study_guide_en,
    study_guide_af = EXCLUDED.study_guide_af,
    duration_days = EXCLUDED.duration_days,
    category = EXCLUDED.category,
    readings = EXCLUDED.readings,
    cover_emoji = EXCLUDED.cover_emoji,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active;

`;
}

sql += `SELECT slug, duration_days, jsonb_array_length(readings) AS day_count FROM reading_plans ORDER BY sort_order;
`;

fs.writeFileSync(OUT_FILE, sql);
console.log(`Written ${OUT_FILE}`);
console.log(`Plans included: ${Object.keys(schedules).filter((s) => PLAN_META[s]).length}`);
