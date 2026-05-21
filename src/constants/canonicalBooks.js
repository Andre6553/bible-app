/**
 * Canonical Protestant Bible book numbering (1–66) used in reading plans.
 * Map to Supabase `books` rows via the `order` column when ids differ.
 */
export const CANONICAL_BOOKS = [
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

export const CANONICAL_BOOKS_BY_ID = Object.fromEntries(
    CANONICAL_BOOKS.map((b) => [b.id, b])
);

export function getCanonicalBookMeta(canonicalBookId) {
    return CANONICAL_BOOKS_BY_ID[Number(canonicalBookId)] || null;
}

/**
 * Resolve a plan's canonical book_id (1–66) to the row in `books.all`.
 */
export function resolveDbBook(books, canonicalBookId) {
    if (!books?.all?.length || canonicalBookId == null) return null;

    const canonicalId = Number(canonicalBookId);
    const meta = getCanonicalBookMeta(canonicalId);

    const byOrder = books.all.find((b) => Number(b.order) === canonicalId);
    if (byOrder) return byOrder;

    const byId = books.all.find((b) => Number(b.id) === canonicalId);
    if (byId && meta && byId.name_full === meta.name) return byId;

    if (meta) {
        const byName = books.all.find((b) => b.name_full === meta.name);
        if (byName) return byName;
    }

    return byId || null;
}

export function resolveDbBookId(books, canonicalBookId) {
    const book = resolveDbBook(books, canonicalBookId);
    return book?.id ?? canonicalBookId;
}

export function getPlanBookDisplayName(books, canonicalBookId, language = 'en') {
    const meta = getCanonicalBookMeta(canonicalBookId);
    const book = resolveDbBook(books, canonicalBookId);

    if (language === 'af') {
        return meta?.name_af || book?.name_af || book?.name_full || meta?.name || `Book ${canonicalBookId}`;
    }
    return book?.name_full || meta?.name || `Book ${canonicalBookId}`;
}
