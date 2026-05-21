import { useState, useEffect } from 'react';
import { getChapterWithFallback } from '../services/bibleService';
import { resolveDbBookId, getPlanBookDisplayName } from '../constants/canonicalBooks';

function PlanDayReading({ dayReading, books, versionId = 'KJV', language = 'en' }) {
    const [passages, setPassages] = useState(null);
    const [loading, setLoading] = useState(true);

    const isAf = language === 'af';
    const t = {
        reading: isAf ? 'Leeswerk' : 'Reading',
        loading: isAf ? 'Laai verse...' : 'Loading verses...',
        noVerses: isAf
            ? 'Geen verse beskikbaar vir hierdie gedeelte nie. Probeer KJV of laai \'n weergawe af in Profiel.'
            : 'No verse text is available for this passage. Try KJV or download a version in Profile.',
        fallback: (requested, used) =>
            isAf
                ? `Wys ${used} — ${requested} het nog nie teks vir hierdie hoofstuk nie.`
                : `Showing ${used} — ${requested} is not available for this chapter yet.`,
    };

    useEffect(() => {
        let cancelled = false;

        async function loadPassages() {
            setLoading(true);

            const loaded = [];
            for (const passage of dayReading.passages || []) {
                const dbBookId = resolveDbBookId(books, passage.book_id);
                const res = await getChapterWithFallback(
                    dbBookId,
                    passage.chapter,
                    versionId,
                    language
                );
                const bookName = getPlanBookDisplayName(books, passage.book_id, language);

                loaded.push({
                    bookId: passage.book_id,
                    chapter: passage.chapter,
                    bookName,
                    verses: res.success ? res.data : [],
                    error: res.success ? null : res.error,
                    versionUsed: res.versionUsed,
                    usedFallback: res.usedFallback,
                    requestedVersion: res.requestedVersion || versionId,
                });
            }

            if (!cancelled) {
                setPassages(loaded);
                setLoading(false);
            }
        }

        if (books.all?.length) {
            loadPassages();
        } else {
            setLoading(false);
            setPassages([]);
        }

        return () => {
            cancelled = true;
        };
    }, [dayReading, books, versionId, language]);

    if (loading) {
        return (
            <div className="plan-study-block plan-reading-block">
                <h4>{t.reading}</h4>
                <div className="plan-reading-loading">
                    <div className="loading-spinner small"></div>
                    <span>{t.loading}</span>
                </div>
            </div>
        );
    }

    const hasVerses = passages?.some((p) => p.verses?.length > 0);
    const displayVersion = passages?.find((p) => p.versionUsed)?.versionUsed || versionId;

    return (
        <div className="plan-study-block plan-reading-block">
            <h4>
                {t.reading}
                <span className="plan-reading-version">{displayVersion}</span>
            </h4>
            {!hasVerses ? (
                <p className="plan-reading-error">{t.noVerses}</p>
            ) : (
                passages.map((passage) =>
                    passage.verses.length > 0 ? (
                        <div
                            key={`${passage.bookId}-${passage.chapter}`}
                            className="plan-passage-block"
                        >
                            {passage.usedFallback && (
                                <p className="plan-reading-fallback">
                                    {t.fallback(passage.requestedVersion, passage.versionUsed)}
                                </p>
                            )}
                            <h5 className="plan-passage-heading">
                                {passage.bookName} {passage.chapter}
                            </h5>
                            <div className="plan-verses-text">
                                {passage.verses.map((v) => (
                                    <span
                                        key={v.verse}
                                        className={`plan-verse ${v.red_letters ? 'red-letter' : ''}`}
                                    >
                                        <sup className="plan-verse-num">{v.verse}</sup>
                                        {v.text}{' '}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ) : null
                )
            )}
        </div>
    );
}

export default PlanDayReading;
