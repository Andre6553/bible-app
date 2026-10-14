/**
 * Enriches reading-plan days with the same chapter commentary used when seeding
 * curated plans (scripts/planCommentary.js → buildCommentarySection).
 * Loaded on demand so the main bundle stays smaller.
 */

let buildCommentarySectionFn = null;

async function loadCommentaryBuilder() {
    if (!buildCommentarySectionFn) {
        const mod = await import('../../scripts/chapterSummaries.js');
        buildCommentarySectionFn = mod.buildCommentarySection;
    }
    return buildCommentarySectionFn;
}

/**
 * Re-build commentary_sections for an existing plan's readings using the LIVE
 * chapter content (summaries, teaching, cross-references) from scripts/.
 *
 * Use this when loading curated plans seeded long ago — their stored
 * commentary_sections may be stale (e.g. missing book-name mappings, thinner
 * cross-refs, or shorter teaching). Re-running the section builder lets the
 * latest content reach the reader without re-seeding the database.
 *
 * Preserves day-level fields (passages, intros, questions, study_guide).
 * Falls back to the original sections if the builder cannot load.
 *
 * @param {Array} readings
 * @returns {Promise<Array>} readings with refreshed commentary_sections
 */
export async function refreshCommentarySections(readings) {
    if (!Array.isArray(readings) || !readings.length) return readings || [];

    let buildSection;
    try {
        buildSection = await loadCommentaryBuilder();
    } catch {
        return readings;
    }

    return readings.map((day) => {
        if (!day?.passages?.length) return day;

        const rebuilt = day.passages
            .map((p) => {
                const bookId = Number(p?.book_id);
                const chapter = Number(p?.chapter);
                if (!bookId || !chapter) return null;
                try {
                    return buildSection(bookId, chapter);
                } catch {
                    return null;
                }
            })
            .filter(Boolean);

        if (!rebuilt.length) return day;

        return { ...day, commentary_sections: rebuilt };
    });
}

/**
 * Attach full study sections (summary, study points, teaching, cross-refs) to each day.
 * Matches the depth of GitHub-seeded plans (Bible in a year, Psalms 30, etc.).
 *
 * @param {Array} readings
 * @param {{ subject?: string, durationDays?: number }} [options]
 */
export async function enrichSubjectPlanReadings(readings, options = {}) {
    const buildSection = await loadCommentaryBuilder();
    if (!Array.isArray(readings)) return [];

    const { subject = '', durationDays = readings.length } = options;
    const subjectLabel = subject ? String(subject).trim() : '';

    return readings.map((day) => {
        if (!day?.passages?.length) return day;

        const commentary_sections = day.passages.map((p) =>
            buildSection(Number(p.book_id), Number(p.chapter)),
        );

        let commentary_intro_en = day.commentary_intro_en || '';
        let commentary_intro_af = day.commentary_intro_af || '';

        if (subjectLabel && commentary_intro_en.length < 400) {
            const arcEn = `Day ${day.day} of ${durationDays} on ${subjectLabel}. `;
            const arcAf = `Dag ${day.day} van ${durationDays} oor ${subjectLabel}. `;
            if (!commentary_intro_en.startsWith('Day ')) {
                commentary_intro_en = arcEn + commentary_intro_en;
            }
            if (!commentary_intro_af.startsWith('Dag ')) {
                commentary_intro_af = arcAf + commentary_intro_af;
            }
        }

        return {
            ...day,
            commentary_intro_en,
            commentary_intro_af,
            commentary_sections,
        };
    });
}
