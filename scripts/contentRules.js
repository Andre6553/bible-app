/**
 * Content rule constants for reading plan commentary generation.
 * See CONTENT_RULES.md for full policy.
 */

export const CONTENT_TYPES = {
    FACT: 'fact',
    CROSS_REF: 'cross_ref',
    REFLECTION: 'reflection',
};

export const UI_LABELS = {
    crossReferences: { en: 'Similar elsewhere in Scripture', af: 'Soortgelyk elders in die Skrif' },
    keyPoints: { en: 'Key points from this chapter', af: 'Sleutel punte uit hierdie hoofstuk' },
    versePrefix: { en: 'See', af: 'Sien' },
};

/** Strip interpretive filler from auto-generated detail text. */
export function factualPointDetail(title, bookName, chapter, verseRef, lang) {
    const ref = verseRef ? ` (${verseRef})` : '';
    if (lang === 'af') {
        return `Die teks van ${bookName} ${chapter}${ref} noem of illustreer: ${title}. Lees daardie verse weer en skryf presies op wat die Bybel sê — nie wat jy dink nie.`;
    }
    return `The text of ${bookName} ${chapter}${ref} records or illustrates: ${title}. Re-read those verses and note exactly what Scripture states.`;
}
