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
    'jonah-4': {
        title_en: 'Jonah in 4 Days',
        title_af: 'Jona in 4 Dae',
        description_en: 'Read the book of Jonah one chapter per day — running from God, the storm, and mercy.',
        description_af: 'Lees die boek Jona een hoofstuk per dag — wegloop van God, die storm en genade.',
        duration_days: 4,
        category: 'topic',
        cover_emoji: '🐋',
        sort_order: 17,
    },
    'ruth-4': {
        title_en: 'Ruth in 4 Days',
        title_af: 'Rut in 4 Dae',
        description_en: 'Four chapters of loyalty, loss, and God’s quiet providence in Ruth.',
        description_af: 'Vier hoofstukke van trou, verlies en God se stille voorsienigheid in Rut.',
        duration_days: 4,
        category: 'topic',
        cover_emoji: '🌾',
        sort_order: 18,
    },
    'esther-10': {
        title_en: 'Esther in 10 Days',
        title_af: 'Ester in 10 Dae',
        description_en: 'Follow Esther’s story one chapter per day — courage for such a time.',
        description_af: 'Volg Ester se storie een hoofstuk per dag — moed vir so ’n tyd.',
        duration_days: 10,
        category: 'topic',
        cover_emoji: '👑',
        sort_order: 19,
    },
    'philemon-1': {
        title_en: 'Philemon in 1 Day',
        title_af: 'Filemon in 1 Dag',
        description_en: 'Paul’s shortest letter — forgiveness and reconciliation in one household.',
        description_af: 'Paulus se kortste brief — vergifnis en versoening in een huishouding.',
        duration_days: 1,
        category: 'nt',
        cover_emoji: '🤝',
        sort_order: 20,
    },
    'jude-1': {
        title_en: 'Jude in 1 Day',
        title_af: 'Judas in 1 Dag',
        description_en: 'One chapter on contending for the faith delivered to God’s people.',
        description_af: 'Een hoofstuk oor stryd vir die geloof aan die heiliges oorgelewer.',
        duration_days: 1,
        category: 'nt',
        cover_emoji: '🛡️',
        sort_order: 21,
    },
    'galatians-6': {
        title_en: 'Galatians in 6 Days',
        title_af: 'Galasiërs in 6 Dae',
        description_en: 'Paul on grace, freedom, and life by the Spirit — one chapter per day.',
        description_af: 'Paulus oor genade, vryheid en lewe deur die Gees — een hoofstuk per dag.',
        duration_days: 6,
        category: 'nt',
        cover_emoji: '⛓️‍💥',
        sort_order: 22,
    },
    'ephesians-6': {
        title_en: 'Ephesians in 6 Days',
        title_af: 'Efesiërs in 6 Dae',
        description_en: 'Christ, the church, and the Christian life — six chapters with daily study notes.',
        description_af: 'Christus, die kerk en die Christelike lewe — ses hoofstukke met daaglikse studienotas.',
        duration_days: 6,
        category: 'nt',
        cover_emoji: '⛪',
        sort_order: 23,
    },
    'philippians-4': {
        title_en: 'Philippians in 4 Days',
        title_af: 'Filippense in 4 Dae',
        description_en: 'Joy in Christ while Paul is in chains — one chapter per day.',
        description_af: 'Blydskap in Christus terwyl Paulus in boeie is — een hoofstuk per dag.',
        duration_days: 4,
        category: 'nt',
        cover_emoji: '🙂',
        sort_order: 24,
    },
    'colossians-4': {
        title_en: 'Colossians in 4 Days',
        title_af: 'Kolossense in 4 Dae',
        description_en: 'The supremacy of Christ and life rooted in Him — four chapters.',
        description_af: 'Die oorhoogheid van Christus en lewe in Hom gewortel — vier hoofstukke.',
        duration_days: 4,
        category: 'nt',
        cover_emoji: '✨',
        sort_order: 25,
    },
    'james-5': {
        title_en: 'James in 5 Days',
        title_af: 'Jakobus in 5 Dae',
        description_en: 'Practical faith — speech, trials, and works that match belief.',
        description_af: 'Praktiese geloof — spraak, versoekings en werk wat by geloof pas.',
        duration_days: 5,
        category: 'nt',
        cover_emoji: '🔥',
        sort_order: 26,
    },
    'hebrews-13': {
        title_en: 'Hebrews in 13 Days',
        title_af: 'Hebreërs in 13 Dae',
        description_en: 'Jesus greater than the old covenant — one chapter of Hebrews per day.',
        description_af: 'Jesus groter as die ou verbond — een hoofstuk van Hebreërs per dag.',
        duration_days: 13,
        category: 'nt',
        cover_emoji: '🏔️',
        sort_order: 27,
    },
    'daniel-12': {
        title_en: 'Daniel in 12 Days',
        title_af: 'Daniël in 12 Dae',
        description_en: 'Faith under empire — visions, prayer, and God’s rule in Daniel.',
        description_af: 'Geloof onder ryk — visioene, gebed en God se heerskappy in Daniël.',
        duration_days: 12,
        category: 'topic',
        cover_emoji: '🦁',
        sort_order: 28,
    },
    'ecclesiastes-12': {
        title_en: 'Ecclesiastes in 12 Days',
        title_af: 'Prediker in 12 Dae',
        description_en: 'Honest questions about meaning, work, and fearing God.',
        description_af: 'Eerlike vrae oor sin, werk en vrees vir God.',
        duration_days: 12,
        category: 'topic',
        cover_emoji: '⏳',
        sort_order: 29,
    },
    'acts-28': {
        title_en: 'Acts in 28 Days',
        title_af: 'Handeling in 28 Dae',
        description_en: 'The church from Pentecost to Rome — one chapter of Acts per day.',
        description_af: 'Die kerk van Pinkster tot Rome — een hoofstuk van Handelinge per dag.',
        duration_days: 28,
        category: 'nt',
        cover_emoji: '🕊️',
        sort_order: 30,
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
const metaJsonPath = path.join(__dirname, 'plan_catalog_meta.json');
fs.writeFileSync(metaJsonPath, JSON.stringify(PLAN_META, null, 2));
console.log(`Written ${OUT_FILE}`);
console.log(`Written ${metaJsonPath}`);
console.log(`Plans included: ${Object.keys(schedules).filter((s) => PLAN_META[s]).length}`);
