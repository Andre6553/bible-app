/**
 * Generates reading schedule JSON for all reading plans.
 * Run: node scripts/generate_reading_schedules.js
 * Outputs: scripts/generated_reading_schedules.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { enrichSchedule } from './planCommentary.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_FILE = path.join(__dirname, 'generated_reading_schedules.json');
const CURATED_DIR = path.join(__dirname, 'curated_plans');

const BOOKS = {
    PSALMS: 19,
    PROVERBS: 20,
    MATTHEW: 40,
    MARK: 41,
    LUKE: 42,
    JOHN: 43,
};

const ALL_BIBLE_BOOKS = [
    { id: 1, name: 'Genesis', name_af: 'Genesis', chapters: 50 },
    { id: 2, name: 'Exodus', name_af: 'Eksodus', chapters: 40 },
    { id: 3, name: 'Leviticus', name_af: 'Levitikus', chapters: 27 },
    { id: 4, name: 'Numbers', name_af: 'Numeri', chapters: 36 },
    { id: 5, name: 'Deuteronomy', name_af: 'Deuteronomium', chapters: 34 },
    { id: 6, name: 'Joshua', name_af: 'Josua', chapters: 24 },
    { id: 7, name: 'Judges', name_af: 'Rigters', chapters: 21 },
    { id: 8, name: 'Ruth', name_af: 'Rut', chapters: 4 },
    { id: 9, name: '1 Samuel', name_af: '1 Samuel', chapters: 31 },
    { id: 10, name: '2 Samuel', name_af: '2 Samuel', chapters: 24 },
    { id: 11, name: '1 Kings', name_af: '1 Konings', chapters: 22 },
    { id: 12, name: '2 Kings', name_af: '2 Konings', chapters: 25 },
    { id: 13, name: '1 Chronicles', name_af: '1 Kronieke', chapters: 29 },
    { id: 14, name: '2 Chronicles', name_af: '2 Kronieke', chapters: 36 },
    { id: 15, name: 'Ezra', name_af: 'Esra', chapters: 10 },
    { id: 16, name: 'Nehemiah', name_af: 'Nehemia', chapters: 13 },
    { id: 17, name: 'Esther', name_af: 'Ester', chapters: 10 },
    { id: 18, name: 'Job', name_af: 'Job', chapters: 42 },
    { id: 19, name: 'Psalms', name_af: 'Psalms', chapters: 150 },
    { id: 20, name: 'Proverbs', name_af: 'Spreuke', chapters: 31 },
    { id: 21, name: 'Ecclesiastes', name_af: 'Prediker', chapters: 12 },
    { id: 22, name: 'Song of Solomon', name_af: 'Hooglied', chapters: 8 },
    { id: 23, name: 'Isaiah', name_af: 'Jesaja', chapters: 66 },
    { id: 24, name: 'Jeremiah', name_af: 'Jeremia', chapters: 52 },
    { id: 25, name: 'Lamentations', name_af: 'Klaagliedere', chapters: 5 },
    { id: 26, name: 'Ezekiel', name_af: 'Esegiël', chapters: 48 },
    { id: 27, name: 'Daniel', name_af: 'Daniël', chapters: 12 },
    { id: 28, name: 'Hosea', name_af: 'Hosea', chapters: 14 },
    { id: 29, name: 'Joel', name_af: 'Joël', chapters: 3 },
    { id: 30, name: 'Amos', name_af: 'Amos', chapters: 9 },
    { id: 31, name: 'Obadiah', name_af: 'Obadja', chapters: 1 },
    { id: 32, name: 'Jonah', name_af: 'Jona', chapters: 4 },
    { id: 33, name: 'Micah', name_af: 'Miga', chapters: 7 },
    { id: 34, name: 'Nahum', name_af: 'Nahum', chapters: 3 },
    { id: 35, name: 'Habakkuk', name_af: 'Habakuk', chapters: 3 },
    { id: 36, name: 'Zephaniah', name_af: 'Sefanja', chapters: 3 },
    { id: 37, name: 'Haggai', name_af: 'Haggai', chapters: 2 },
    { id: 38, name: 'Zechariah', name_af: 'Sagaria', chapters: 14 },
    { id: 39, name: 'Malachi', name_af: 'Maleagi', chapters: 4 },
    { id: 40, name: 'Matthew', name_af: 'Matteus', chapters: 28 },
    { id: 41, name: 'Mark', name_af: 'Markus', chapters: 16 },
    { id: 42, name: 'Luke', name_af: 'Lukas', chapters: 24 },
    { id: 43, name: 'John', name_af: 'Johannes', chapters: 21 },
    { id: 44, name: 'Acts', name_af: 'Handeling', chapters: 28 },
    { id: 45, name: 'Romans', name_af: 'Romeine', chapters: 16 },
    { id: 46, name: '1 Corinthians', name_af: '1 Korintiërs', chapters: 16 },
    { id: 47, name: '2 Corinthians', name_af: '2 Korintiërs', chapters: 13 },
    { id: 48, name: 'Galatians', name_af: 'Galasiërs', chapters: 6 },
    { id: 49, name: 'Ephesians', name_af: 'Efesiërs', chapters: 6 },
    { id: 50, name: 'Philippians', name_af: 'Filippense', chapters: 4 },
    { id: 51, name: 'Colossians', name_af: 'Kolossense', chapters: 4 },
    { id: 52, name: '1 Thessalonians', name_af: '1 Tessalonisense', chapters: 5 },
    { id: 53, name: '2 Thessalonians', name_af: '2 Tessalonisense', chapters: 3 },
    { id: 54, name: '1 Timothy', name_af: '1 Timoteus', chapters: 6 },
    { id: 55, name: '2 Timothy', name_af: '2 Timoteus', chapters: 4 },
    { id: 56, name: 'Titus', name_af: 'Titus', chapters: 3 },
    { id: 57, name: 'Philemon', name_af: 'Filemon', chapters: 1 },
    { id: 58, name: 'Hebrews', name_af: 'Hebreërs', chapters: 13 },
    { id: 59, name: 'James', name_af: 'Jakobus', chapters: 5 },
    { id: 60, name: '1 Peter', name_af: '1 Petrus', chapters: 5 },
    { id: 61, name: '2 Peter', name_af: '2 Petrus', chapters: 3 },
    { id: 62, name: '1 John', name_af: '1 Johannes', chapters: 5 },
    { id: 63, name: '2 John', name_af: '2 Johannes', chapters: 1 },
    { id: 64, name: '3 John', name_af: '3 Johannes', chapters: 1 },
    { id: 65, name: 'Jude', name_af: 'Judas', chapters: 1 },
    { id: 66, name: 'Revelation', name_af: 'Openbaring', chapters: 22 },
];

const BOOK_BY_ID = Object.fromEntries(ALL_BIBLE_BOOKS.map((b) => [b.id, b]));

function distributeChaptersAcrossDays(chapters, days) {
    const total = chapters.length;
    const base = Math.floor(total / days);
    const remainder = total % days;
    const readings = [];
    let idx = 0;

    for (let day = 1; day <= days; day++) {
        const count = base + (day <= remainder ? 1 : 0);
        const passages = chapters.slice(idx, idx + count);
        if (passages.length === 0) break;
        idx += count;
        readings.push({ day, passages });
    }
    return readings;
}

function chaptersFromBooks(books) {
    const all = [];
    for (const book of books) {
        for (let ch = 1; ch <= book.chapters; ch++) {
            all.push({
                book_id: book.id,
                chapter: ch,
                bookName: book.name,
                bookNameAf: book.name_af,
            });
        }
    }
    return all;
}

function titleFromPassages(passages) {
    const first = passages[0];
    const last = passages[passages.length - 1];
    const name = first.bookName || BOOK_BY_ID[first.book_id]?.name;
    const nameAf = first.bookNameAf || BOOK_BY_ID[first.book_id]?.name_af || name;
    const lastName = last.bookName || BOOK_BY_ID[last.book_id]?.name;
    const lastNameAf = last.bookNameAf || BOOK_BY_ID[last.book_id]?.name_af || lastName;

    if (passages.length === 1) {
        return { title_en: `${name} ${first.chapter}`, title_af: `${nameAf} ${first.chapter}` };
    }
    if (first.book_id === last.book_id) {
        return {
            title_en: `${name} ${first.chapter}–${last.chapter}`,
            title_af: `${nameAf} ${first.chapter}–${last.chapter}`,
        };
    }
    return {
        title_en: `${name} ${first.chapter} – ${lastName} ${last.chapter}`,
        title_af: `${nameAf} ${first.chapter} – ${lastNameAf} ${last.chapter}`,
    };
}

function buildDistributedPlan(books, days) {
    const allChapters = chaptersFromBooks(books);
    const daySlices = distributeChaptersAcrossDays(allChapters, days);
    return daySlices.map(({ day, passages }) => {
        const clean = passages.map(({ book_id, chapter }) => ({ book_id, chapter }));
        const { title_en, title_af } = titleFromPassages(passages);
        return { day, title_en, title_af, passages: clean };
    });
}

function buildOneChapterPerDay(bookId, days) {
    const book = BOOK_BY_ID[bookId];
    const readings = [];
    for (let day = 1; day <= days; day++) {
        readings.push({
            day,
            title_en: `${book.name} ${day}`,
            title_af: `${book.name_af} ${day}`,
            passages: [{ book_id: bookId, chapter: day }],
        });
    }
    return readings;
}

function buildProverbs31() {
    return buildOneChapterPerDay(BOOKS.PROVERBS, 31);
}

function buildPsalms30() {
    const allPsalms = Array.from({ length: 150 }, (_, i) => ({
        book_id: BOOKS.PSALMS,
        chapter: i + 1,
        bookName: 'Psalms',
        bookNameAf: 'Psalms',
    }));
    return distributeChaptersAcrossDays(allPsalms, 30).map(({ day, passages }) => {
        const clean = passages.map(({ book_id, chapter }) => ({ book_id, chapter }));
        const { title_en, title_af } = titleFromPassages(passages);
        return { day, title_en, title_af, passages: clean };
    });
}

function buildGospels40() {
    const gospelBooks = ALL_BIBLE_BOOKS.filter((b) => b.id >= 40 && b.id <= 43);
    return buildDistributedPlan(gospelBooks, 40);
}

function buildNT90() {
    const ntBooks = ALL_BIBLE_BOOKS.filter((b) => b.id >= 40);
    return buildDistributedPlan(ntBooks, 90);
}

function buildBible365() {
    return buildDistributedPlan(ALL_BIBLE_BOOKS, 365);
}

function buildOT180() {
    const otBooks = ALL_BIBLE_BOOKS.filter((b) => b.id <= 39);
    return buildDistributedPlan(otBooks, 180);
}

function buildPaul30() {
    const paulBooks = ALL_BIBLE_BOOKS.filter((b) => b.id >= 45 && b.id <= 57);
    return buildDistributedPlan(paulBooks, 30);
}

function buildRevelation22() {
    return buildOneChapterPerDay(66, 22);
}

function buildRomans16() {
    return buildOneChapterPerDay(45, 16);
}

function buildJohn21() {
    return buildOneChapterPerDay(43, 21);
}

function loadCuratedPlans() {
    const curated = {};
    if (!fs.existsSync(CURATED_DIR)) return curated;

    for (const file of fs.readdirSync(CURATED_DIR).filter((f) => f.endsWith('.json'))) {
        const slug = file.replace('.json', '');
        curated[slug] = JSON.parse(fs.readFileSync(path.join(CURATED_DIR, file), 'utf8'));
    }
    return curated;
}

const rawSchedules = {
    'proverbs-31': buildProverbs31(),
    'psalms-30': buildPsalms30(),
    'gospels-40': buildGospels40(),
    'nt-90': buildNT90(),
    'bible-365': buildBible365(),
    'ot-180': buildOT180(),
    'paul-30': buildPaul30(),
    'revelation-22': buildRevelation22(),
    'romans-16': buildRomans16(),
    'john-21': buildJohn21(),
    ...loadCuratedPlans(),
};

const schedules = Object.fromEntries(
    Object.entries(rawSchedules).map(([slug, readings]) => [slug, enrichSchedule(readings, slug)])
);

fs.writeFileSync(OUT_FILE, JSON.stringify(schedules, null, 2));
console.log(`Written ${OUT_FILE}`);
for (const [slug, readings] of Object.entries(schedules)) {
    console.log(`  ${slug}: ${readings.length} days`);
}
