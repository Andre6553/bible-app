
export const AFRIKAANS_BOOK_NAMES = {
    "Genesis": "Genesis",
    "Exodus": "Eksodus",
    "Leviticus": "Levitikus",
    "Numbers": "Numeri",
    "Deuteronomy": "Deuteronomium",
    "Joshua": "Josua",
    "Judges": "Rigters",
    "Ruth": "Rut",
    "1 Samuel": "1 Samuel",
    "2 Samuel": "2 Samuel",
    "1 Kings": "1 Konings",
    "2 Kings": "2 Konings",
    "1 Chronicles": "1 Kronieke",
    "2 Chronicles": "2 Kronieke",
    "Ezra": "Esra",
    "Nehemiah": "Nehemia",
    "Esther": "Ester",
    "Job": "Job",
    "Psalms": "Psalms",
    "Proverbs": "Spreuke",
    "Ecclesiastes": "Prediker",
    "Song of Solomon": "Hooglied",
    "Isaiah": "Jesaja",
    "Jeremiah": "Jeremia",
    "Lamentations": "Klaagliedere",
    "Ezekiel": "Esegiël",
    "Daniel": "Daniël",
    "Hosea": "Hosea",
    "Joel": "Joël",
    "Amos": "Amos",
    "Obadiah": "Obadja",
    "Jonah": "Jona",
    "Micah": "Miga",
    "Nahum": "Nahum",
    "Habakkuk": "Habakuk",
    "Zephaniah": "Sefanja",
    "Haggai": "Haggai",
    "Zechariah": "Sagaria",
    "Malachi": "Maleagi",
    "Matthew": "Matteus",
    "Mark": "Markus",
    "Luke": "Lukas",
    "John": "Johannes",
    "Acts": "Handelinge",
    "Romans": "Romeine",
    "1 Corinthians": "1 Korintiërs",
    "2 Corinthians": "2 Korintiërs",
    "Galatians": "Galasiërs",
    "Ephesians": "Efesiërs",
    "Philippians": "Filippense",
    "Colossians": "Kolossense",
    "1 Thessalonians": "1 Tessalonisense",
    "2 Thessalonians": "2 Tessalonisense",
    "1 Timothy": "1 Timoteus",
    "2 Timothy": "2 Timoteus",
    "Titus": "Titus",
    "Philemon": "Filemon",
    "Hebrews": "Hebreërs",
    "James": "Jakobus",
    "1 Peter": "1 Petrus",
    "2 Peter": "2 Petrus",
    "1 John": "1 Johannes",
    "2 John": "2 Johannes",
    "3 John": "3 Johannes",
    "Jude": "Judas",
    "Revelation": "Openbaring"
};

export const getLocalizedBookName = (bookName, versionId) => {
    if (!bookName) return '';

    // Normalize version ID to check for Afrikaans
    const isAfrikaans = ['AFR53', 'AFR83'].includes(versionId);

    if (isAfrikaans) {
        return AFRIKAANS_BOOK_NAMES[bookName] || bookName;
    }

    return bookName;
};
