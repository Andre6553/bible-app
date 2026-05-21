/**
 * Factual study point expansion for chapters without curated detail.
 * See CONTENT_RULES.md — no doctrinal speculation in auto text.
 */

import { factualPointDetail } from './contentRules.js';

const PSALM_READING_GUIDES = {
    en: {
        'Opening claim or address (early verses)': {
            verses: 'opening verses',
            detail:
                'Read the first lines of this psalm and note who speaks, whom they address, and the main claim before the rest of the poem unfolds.',
        },
        'Central prayer, threat, or praise (middle section)': {
            verses: 'middle section',
            detail:
                'Read the middle of the psalm and list what the writer asks for, remembers, warns about, or praises — using the psalm\'s own words.',
        },
        'Closing trust, vow, or call to worship (final verses)': {
            verses: 'final verses',
            detail:
                'Read how the psalm ends: note any vow, command to worship, renewed trust, or repeated refrain in the closing lines.',
        },
    },
    af: {
        'Openingsverklaring of aanspraak (vroeë verse)': {
            verses: 'openingsverse',
            detail:
                'Lees die eerste reëls van hierdie psalm en let op wie praat, tot wie hulle rig, en die hoof-bewering voordat die res van die gedig ontvou.',
        },
        'Sentrale gebed, bedreiging of lof (middelste gedeelte)': {
            verses: 'middelste gedeelte',
            detail:
                'Lees die middel van die psalm en skryf op wat die skrywer vra, onthou, waarsku oor, of prys — met die psalm se eie woorde.',
        },
        'Slotsvertroue, gelofte of oproep tot aanbidding (slotverse)': {
            verses: 'slotverse',
            detail:
                'Lees hoe die psalm eindig: let op enige gelofte, oproep tot aanbidding, hernuide vertroue, of herhaalde refrein in die slot.',
        },
    },
};

function isPsalmsBook(bookName) {
    return bookName === 'Psalms';
}

function psalmHighlightsToStudyPoints(highlights, chapter, lang) {
    const guides = PSALM_READING_GUIDES[lang] || PSALM_READING_GUIDES.en;
    return (highlights || []).map((title) => {
        const guide = guides[title];
        if (guide) {
            return { title, verses: guide.verses, detail: guide.detail };
        }
        return {
            title,
            verses: '',
            detail: factualPointDetail(title, 'Psalms', chapter, '', lang),
        };
    });
}

export function highlightsToStudyPoints(highlights, bookName, chapter, lang) {
    if (isPsalmsBook(bookName)) {
        return psalmHighlightsToStudyPoints(highlights, chapter, lang);
    }
    return (highlights || []).map((title) => ({
        title,
        verses: '',
        detail: factualPointDetail(title, bookName, chapter, '', lang),
    }));
}

export function normalizeStudyContent(langContent, bookName, chapter, lang) {
    if (langContent.points?.length) {
        return {
            summary: langContent.summary,
            points: langContent.points.map((p) => ({
                title: p.title,
                verses: p.verses || '',
                detail: p.detail,
            })),
        };
    }

    return {
        summary: langContent.summary,
        points: highlightsToStudyPoints(langContent.highlights, bookName, chapter, lang),
    };
}

export function enrichSummary(summary, bookName, chapter, lang) {
    if (!summary || summary.length > 400) return summary;

    if (lang === 'af') {
        return `${summary} Lees ${bookName} ${chapter} self en kontroleer elke stelling teen die verse in jou Bybelweergawe.`;
    }

    return `${summary} Read ${bookName} ${chapter} yourself and verify each statement against the verses in your Bible version.`;
}
