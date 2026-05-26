import { AFRIKAANS_BOOK_NAMES } from '../constants/bookNames';

/** Light purple used for AI-mentioned verses that are not highlighted yet. */
export const AI_SEARCH_HIGHLIGHT_COLOR = '#ddd6fe';

const CHAPTER_VERSE_PATTERN = /(\d{1,3})\s*:\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?/g;

export function normalizeBookName(name = '') {
    return String(name)
        .toLowerCase()
        .trim()
        .replace(/^first /, '1 ')
        .replace(/^second /, '2 ')
        .replace(/^third /, '3 ')
        .replace(/^i /, '1 ')
        .replace(/^ii /, '2 ')
        .replace(/^iii /, '3 ')
        .replace(/^1st /, '1 ')
        .replace(/^2nd /, '2 ')
        .replace(/^3rd /, '3 ')
        .replace(/^psalm$/, 'psalms')
        .replace(/^proverb$/, 'proverbs')
        .replace(/^song of solomon$/, 'song of songs')
        .replace(/^songs of solomon$/, 'song of songs')
        .replace(/^revelation$/, 'revelations')
        .replace(/\./g, '')
        .replace(/\s+/g, ' ');
}

function buildBookMatchers(books = []) {
    const matchers = [];

    books.forEach((book) => {
        const names = new Set([book.name_full]);
        const afName = AFRIKAANS_BOOK_NAMES[book.name_full];
        if (afName) names.add(afName);
        if (book.name_af) names.add(book.name_af);

        if (book.name_full === 'Psalms') names.add('Psalm');
        if (book.name_full === 'Song of Solomon') {
            names.add('Song of Songs');
            names.add('Songs of Solomon');
        }

        matchers.push({
            book,
            names: Array.from(names).sort((a, b) => b.length - a.length),
        });
    });

    return matchers.sort((a, b) => {
        const aLen = a.names[0]?.length || 0;
        const bLen = b.names[0]?.length || 0;
        return bLen - aLen;
    });
}

export function resolveBookFromName(bookNameRaw, books = []) {
    if (!bookNameRaw || !books.length) return null;

    const targetName = normalizeBookName(bookNameRaw);
    if (!targetName) return null;

    let book = books.find((b) => normalizeBookName(b.name_full) === targetName);
    if (book) return book;

    const englishFromAf = Object.entries(AFRIKAANS_BOOK_NAMES).find(
        ([, af]) => normalizeBookName(af) === targetName
    );
    if (englishFromAf) {
        book = books.find((b) => b.name_full === englishFromAf[0]);
        if (book) return book;
    }

    book = books.find((b) => {
        const dbName = normalizeBookName(b.name_full);
        return dbName.startsWith(targetName) || targetName.startsWith(dbName);
    });

    return book || null;
}

export function expandVerseNumbers(startVerse, endVerse) {
    const start = Number(startVerse);
    const end = Number(endVerse ?? startVerse);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return [];

    const from = Math.min(start, end);
    const to = Math.max(start, end);
    const verses = [];
    for (let verse = from; verse <= to; verse += 1) {
        verses.push(verse);
        if (verses.length > 40) break;
    }
    return verses;
}

function makeReference(book, chapter, verses, displayRef) {
    const sortedVerses = [...verses];
    const key = `${book.id}-${chapter}-${sortedVerses.join('-')}`;
    return {
        key,
        bookId: book.id,
        bookName: book.name_full,
        chapter: Number(chapter),
        verses: sortedVerses,
        displayRef,
    };
}

export function parseSingleCitation(citation, books = []) {
    const cleaned = String(citation || '').replace(/^📖\s*/, '').trim();
    const lastSpaceIndex = cleaned.lastIndexOf(' ');
    if (lastSpaceIndex === -1) return null;

    const bookNameRaw = cleaned.substring(0, lastSpaceIndex).trim();
    const refPart = cleaned.substring(lastSpaceIndex + 1).trim();
    const chapterMatch = refPart.match(/^(\d{1,3})\s*:\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?$/);
    if (!chapterMatch) return null;

    const book = resolveBookFromName(bookNameRaw, books);
    if (!book) return null;

    const chapter = Number(chapterMatch[1]);
    const verses = expandVerseNumbers(chapterMatch[2], chapterMatch[3]);
    if (!verses.length) return null;

    const displayRef = chapterMatch[3]
        ? `${book.name_full} ${chapter}:${chapterMatch[2]}-${chapterMatch[3]}`
        : `${book.name_full} ${chapter}:${chapterMatch[2]}`;

    return makeReference(book, chapter, verses, displayRef);
}

export function parseBracketCitation(content, books = []) {
    const cleaned = String(content || '').trim();
    if (!cleaned) return [];

    if (!cleaned.includes(',')) {
        const single = parseSingleCitation(cleaned, books);
        return single ? [single] : [];
    }

    const refs = cleaned.split(',').map((part) => part.trim()).filter(Boolean);
    const first = parseSingleCitation(refs[0], books);
    if (!first) return [];

    const results = [first];
    const bookName = first.bookName;

    for (let i = 1; i < refs.length; i += 1) {
        const part = refs[i];
        const fullRef = part.includes(' ') ? part : `${bookName} ${part}`;
        const parsed = parseSingleCitation(fullRef, books);
        if (parsed) results.push(parsed);
    }

    return results;
}

function findBookEndingAt(text, endIndex, books) {
    const prefix = text.slice(0, endIndex).replace(/[📖•*,;:\-–—]\s*$/g, '').trimEnd();
    if (!prefix) return null;

    const matchers = buildBookMatchers(books);
    for (const matcher of matchers) {
        for (const name of matcher.names) {
            if (prefix.toLowerCase().endsWith(name.toLowerCase())) {
                const before = prefix.slice(0, prefix.length - name.length);
                if (before === '' || /[\s([{"']/.test(before.slice(-1))) {
                    return {
                        book: matcher.book,
                        name,
                        startIndex: prefix.length - name.length,
                    };
                }
            }
        }
    }

    return null;
}

function addReference(reference, refs, seen) {
    if (!reference) return;
    if (seen.has(reference.key)) return;
    seen.add(reference.key);
    refs.push(reference);
}

export function extractVerseReferencesFromText(text, books = []) {
    if (!text || !books.length) return [];

    const refs = [];
    const seen = new Set();
    const source = String(text);

    for (const match of source.matchAll(/\[\[(.*?)\]\]/g)) {
        parseBracketCitation(match[1], books).forEach((ref) => addReference(ref, refs, seen));
    }

    const plainSource = source.replace(/\[\[.*?\]\]/g, ' ');
    const pattern = new RegExp(CHAPTER_VERSE_PATTERN.source, 'g');
    let match;

    while ((match = pattern.exec(plainSource)) !== null) {
        const bookMatch = findBookEndingAt(plainSource, match.index, books);
        if (!bookMatch) continue;

        const chapter = Number(match[1]);
        const verses = expandVerseNumbers(match[2], match[3]);
        if (!verses.length) continue;

        const displayRef = match[3]
            ? `${bookMatch.book.name_full} ${chapter}:${match[2]}-${match[3]}`
            : `${bookMatch.book.name_full} ${chapter}:${match[2]}`;

        addReference(makeReference(bookMatch.book, chapter, verses, displayRef), refs, seen);
    }

    return refs;
}

export function extractVerseReferencesFromConversation(conversation = [], books = []) {
    const refs = [];
    const seen = new Set();

    conversation.forEach((turn) => {
        if (turn.role !== 'ai') return;
        extractVerseReferencesFromText(turn.content, books).forEach((ref) => addReference(ref, refs, seen));
    });

    return refs;
}

export function referencesToHighlightVerses(references = []) {
    const verses = [];
    references.forEach((ref) => {
        ref.verses.forEach((verse) => {
            verses.push({
                bookId: ref.bookId,
                chapter: ref.chapter,
                verse,
            });
        });
    });
    return verses;
}

/**
 * Split plain text into strings and verse-link segments for React rendering.
 */
export function splitTextWithVerseLinks(text, books = []) {
    if (!text || !books.length) return [{ type: 'text', content: text || '' }];

    const segments = [];
    const plainSource = String(text);
    const pattern = new RegExp(CHAPTER_VERSE_PATTERN.source, 'g');
    let lastIndex = 0;
    let match;

    while ((match = pattern.exec(plainSource)) !== null) {
        const bookMatch = findBookEndingAt(plainSource, match.index, books);
        if (!bookMatch) continue;

        const chapter = Number(match[1]);
        const displayRef = match[3]
            ? `${bookMatch.book.name_full} ${chapter}:${match[2]}-${match[3]}`
            : `${bookMatch.book.name_full} ${chapter}:${match[2]}`;

        const fullStart = bookMatch.startIndex;
        const fullEnd = match.index + match[0].length;

        if (fullStart < lastIndex) continue;

        if (fullStart > lastIndex) {
            segments.push({ type: 'text', content: plainSource.slice(lastIndex, fullStart) });
        }

        segments.push({ type: 'ref', content: displayRef });
        lastIndex = fullEnd;
    }

    if (lastIndex < plainSource.length) {
        segments.push({ type: 'text', content: plainSource.slice(lastIndex) });
    }

    if (segments.length === 0) {
        return [{ type: 'text', content: plainSource }];
    }

    return segments;
}
