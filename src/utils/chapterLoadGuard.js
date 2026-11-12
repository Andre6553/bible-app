/**
 * Latest-request token for overlapping chapter fetches (normal + split view).
 */
export function nextChapterLoadId(current) {
    return (Number(current) || 0) + 1;
}

export function isStaleChapterLoad(loadId, currentLoadId) {
    return loadId !== currentLoadId;
}

/**
 * Decide which verse arrays to apply after a load finishes.
 * Delayed older responses must not overwrite a newer selection.
 */
export function applyChapterLoadResult({
    loadId,
    currentLoadId,
    main,
    secondary,
    split,
}) {
    if (isStaleChapterLoad(loadId, currentLoadId)) {
        return { apply: false, verses: null, secondVerses: null };
    }
    return {
        apply: true,
        verses: main,
        secondVerses: split ? secondary : [],
    };
}
