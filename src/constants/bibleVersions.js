/**
 * Canonical Bible version list (shared to avoid circular imports with bookNames).
 */
export const SUPPORTED_VERSIONS = [
    { id: 'AFR53', name: 'Afrikaans 1953', abbreviation: 'AFR53', language: 'af' },
    { id: 'KJV', name: 'King James Version', abbreviation: 'KJV', language: 'en' },
    { id: 'NKJV', name: 'New King James Version', abbreviation: 'NKJV', language: 'en' },
    { id: 'NIV', name: 'New International Version', abbreviation: 'NIV', language: 'en' },
    { id: 'ESV', name: 'English Standard Version', abbreviation: 'ESV', language: 'en' },
    { id: 'NLT', name: 'New Living Translation', abbreviation: 'NLT', language: 'en' },
    { id: 'AMP', name: 'Amplified Bible', abbreviation: 'AMP', language: 'en' },
    { id: 'AFR83', name: 'Afrikaans 1983', abbreviation: 'AFR83', language: 'af' },
    { id: 'AFRNLV', name: 'Afrikaanse Nuwe Lewe', abbreviation: 'AFR NLV', language: 'af' },
    { id: 'XHO22', name: 'Xhosa 2022', abbreviation: 'XHO22', language: 'xh' },
];

const VERSION_BY_ID = new Map(
    SUPPORTED_VERSIONS.map((v) => [v.id.toUpperCase(), v])
);

/**
 * @param {string} versionId
 * @returns {{ id: string, name: string, abbreviation: string, language: string } | undefined}
 */
export const getVersionById = (versionId) => {
    if (!versionId) return undefined;
    return VERSION_BY_ID.get(String(versionId).toUpperCase());
};

/**
 * True when book names should use Afrikaans labels (any Afrikaans Bible version or UI lang "af").
 * When a known version id is passed, the version's `language` field wins (English versions stay English).
 * @param {string} [versionIdOrLang] - version id (e.g. AFRNLV) or language code (e.g. af, en)
 */
export const isAfrikaansVersion = (versionIdOrLang) => {
    if (!versionIdOrLang) return false;

    const version = getVersionById(versionIdOrLang);
    if (version) {
        return (version.language || '').toLowerCase().startsWith('af');
    }

    const lower = String(versionIdOrLang).toLowerCase();
    return lower === 'af' || lower === 'afrikaans' || lower.startsWith('af-');
};

/**
 * Language code for book-name display (reading plans, passage refs).
 * Prefers the active Bible version over app UI language when version is known.
 */
export const getBookNamesLanguage = (versionId, settingsLanguage = 'en') => {
    const version = getVersionById(versionId);
    if (version) {
        return (version.language || '').toLowerCase().startsWith('af') ? 'af' : 'en';
    }
    return settingsLanguage === 'af' ? 'af' : 'en';
};
