import { useState, useEffect } from 'react';
import { getChapter } from '../services/bibleService';
import { getLocalizedBookName } from '../constants/bookNames';

function PlanDayReading({ dayReading, books, versionId = 'KJV', language = 'en' }) {
    const [passages, setPassages] = useState(null);
    const [loading, setLoading] = useState(true);

    const isAf = language === 'af';
    const t = {
        reading: isAf ? 'Leeswerk' : 'Reading',
        loading: isAf ? 'Laai verse...' : 'Loading verses...',
        noVerses: isAf ? 'Kon nie verse vir hierdie weergawe laai nie.' : 'Could not load verses for this version.',
    };

    useEffect(() => {
        let cancelled = false;

        async function loadPassages() {
            setLoading(true);

            const loaded = [];
            for (const passage of dayReading.passages || []) {
                const res = await getChapter(passage.book_id, passage.chapter, versionId);
                const book = books.all?.find((b) => b.id == passage.book_id);
                const bookName = book
                    ? getLocalizedBookName(book.name_full, versionId)
                    : `Book ${passage.book_id}`;

                loaded.push({
                    bookId: passage.book_id,
                    chapter: passage.chapter,
                    bookName,
                    verses: res.success ? res.data : [],
                    error: res.success ? null : res.error,
                });
            }

            if (!cancelled) {
                setPassages(loaded);
                setLoading(false);
            }
        }

        loadPassages();
        return () => {
            cancelled = true;
        };
    }, [dayReading, books, versionId]);

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

    return (
        <div className="plan-study-block plan-reading-block">
            <h4>
                {t.reading}
                <span className="plan-reading-version">{versionId}</span>
            </h4>
            {!hasVerses ? (
                <p className="plan-reading-error">{t.noVerses}</p>
            ) : (
                passages.map((passage) => (
                    <div
                        key={`${passage.bookId}-${passage.chapter}`}
                        className="plan-passage-block"
                    >
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
                ))
            )}
        </div>
    );
}

export default PlanDayReading;
