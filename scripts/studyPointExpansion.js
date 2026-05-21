/**
 * Factual study point expansion for chapters without curated detail.
 * See CONTENT_RULES.md — no doctrinal speculation in auto text.
 */

import { factualPointDetail } from './contentRules.js';

export function highlightsToStudyPoints(highlights, bookName, chapter, lang) {
    return (highlights || []).map((title, i) => ({
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
