import {
    getDayCommentaryIntro,
    getDayCommentarySections,
    getDayQuestions,
} from '../services/readingPlanService';

/**
 * Full plan-day study content (same depth as ReadingPlanDetail expanded day).
 * Used in BibleReader banner so users get the full guide while reading Scripture.
 */
function PlanDayStudyPanel({ dayReading, language = 'en', currentPassage = null, variant = 'reader' }) {
    if (!dayReading) return null;

    const isAf = language === 'af';
    const intro = getDayCommentaryIntro(dayReading, language);
    const sections = getDayCommentarySections(dayReading, language);
    const questions = getDayQuestions(dayReading, language);

    const t = {
        studyGuide: isAf ? 'Studie gids vir vandag' : "Today's study guide",
        commentary: isAf ? 'Kommentaar' : 'Commentary',
        keyPoints: isAf ? 'Sleutel punte uit hierdie hoofstuk' : 'Key points from this chapter',
        godTeaches: isAf ? 'Wat God ons wil leer' : 'What God wants us to know',
        why: isAf ? 'Hoekom? (uit hierdie teks)' : 'Why? (from this text)',
        similar: isAf ? 'Soortgelyk elders in die Skrif' : 'Similar elsewhere in Scripture',
        questions: isAf ? 'Refleksie vrae' : 'Reflection questions',
        seeVerses: isAf ? 'Sien' : 'See',
        readingNow: isAf ? 'Jy lees nou' : 'You are reading',
    };

    const isCurrentSection = (section) => {
        if (!currentPassage) return true;
        return (
            Number(section.book_id) === Number(currentPassage.book_id) &&
            Number(section.chapter) === Number(currentPassage.chapter)
        );
    };

    const wrapClass =
        variant === 'reader'
            ? 'plan-reader-study-panel'
            : 'plan-day-study-panel';

    return (
        <div className={wrapClass}>
            {intro && (
                <div className="plan-study-block plan-reader-intro-block">
                    <h4 className="plan-reader-study-label">{t.studyGuide}</h4>
                    <p className="plan-commentary-intro plan-reader-intro-text">{intro}</p>
                </div>
            )}

            {sections.length > 0 && (
                <div className="plan-study-block plan-commentary-block">
                    <h4 className="plan-reader-study-label">{t.commentary}</h4>
                    {sections.map((section, idx) => {
                        const isActive = isCurrentSection(section);
                        return (
                            <div
                                key={`${section.book_id || 's'}-${section.chapter || idx}`}
                                className={`plan-commentary-section ${isActive ? 'plan-section-active' : ''}`}
                            >
                                {isActive && currentPassage && (
                                    <span className="plan-reader-reading-now">{t.readingNow}</span>
                                )}
                                {section.heading && (
                                    <h5 className="plan-commentary-heading">{section.heading}</h5>
                                )}
                                <p className="plan-commentary-summary">{section.summary}</p>
                                {section.studyPoints?.length > 0 && (
                                    <div className="plan-commentary-highlights">
                                        <span className="plan-commentary-highlights-label">{t.keyPoints}</span>
                                        <div className="plan-study-points">
                                            {section.studyPoints.map((point, i) => (
                                                <div key={i} className="plan-study-point">
                                                    <strong className="plan-study-point-title">
                                                        {point.title}
                                                        {point.verses && (
                                                            <span className="plan-verse-ref">
                                                                {' '}
                                                                {t.seeVerses} {point.verses}
                                                            </span>
                                                        )}
                                                    </strong>
                                                    {point.detail && (
                                                        <p className="plan-study-point-detail">{point.detail}</p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {section.teaching && (
                                    <div className="plan-teaching-block">
                                        <span className="plan-commentary-highlights-label">{t.godTeaches}</span>
                                        <p className="plan-teaching-message">{section.teaching}</p>
                                        {section.teachingWhy && (
                                            <>
                                                <span className="plan-teaching-why-label">{t.why}</span>
                                                <p className="plan-teaching-why">{section.teachingWhy}</p>
                                            </>
                                        )}
                                    </div>
                                )}
                                {section.crossReferences?.length > 0 && (
                                    <div className="plan-cross-references">
                                        <span className="plan-commentary-highlights-label">{t.similar}</span>
                                        {section.crossReferences.map((cr, i) => (
                                            <div key={i} className="plan-cross-ref">
                                                <strong className="plan-cross-ref-title">{cr.ref}</strong>
                                                <p className="plan-cross-ref-text">{cr.comparison}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {questions.length > 0 && (
                <div className="plan-study-block">
                    <h4 className="plan-reader-study-label">{t.questions}</h4>
                    <ul className="plan-study-questions">
                        {questions.map((q, i) => (
                            <li key={i}>{q}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

export default PlanDayStudyPanel;
