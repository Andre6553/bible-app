import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { getUserId } from '../services/bibleService';
import { logBlogView } from '../services/blogService';
import { getForYouContext, getForYouPlan, cachedForSlot, getForYouPiece, patchForYouInterest, setForYouFeedback, getSavedForYou } from '../services/forYouService';
import { FOR_YOU_TOPICS, DEFAULT_TOPIC_IDS, topicLabel } from '../config/forYouTopics';
import { formatLabel } from '../config/forYouFormats';
import { localDay, preferenceStates } from '../utils/forYouSelection';
import { copyToClipboard } from '../utils/appUtils';
import './Blog.css';

const WORDS = {
    en: {
        title: 'For You', subtitle: 'Scripture, reflection and something new to learn.', daily: 'Today’s reflection',
        reading: 'Recommended reading', loading: 'Preparing your reading…', newDaily: 'Another reflection', newArticles: 'New suggestions',
        retry: 'Try again', saved: 'Saved reading', noSaved: 'Save a piece to find it here later.', interests: 'Manage my interests',
        interestHelp: 'Choose what interests you. Excluded topics stay out of all new suggestions.', prefer: 'Prefer', exclude: 'Exclude', neutral: 'Automatic',
        pending: 'Your preferences are saved. Update recommendations to apply them.', update: 'Update recommendations',
        empty: 'No eligible topics. Enable an interest below to receive suggestions.', continue: 'Continue your reading plan',
        save: 'Save', helpful: 'Helpful', read: 'Already read', less: 'Less like this', feedbackHelp: 'Less like this lowers similar suggestions; it does not permanently exclude a topic.',
        offline: 'Showing saved content. Reconnect before generating or changing preferences.',
        busy: 'This piece is being prepared in another tab. Try again shortly.', cooldown: 'This section can be refreshed later. Your existing reading is kept.',
        error: 'Could not load this section. Your previous reading has been kept.', setup: 'For You could not connect. Please try again. The new database setup may still be pending.',
        close: 'Close', open: 'Read article', passage: 'Read the passage in the Bible', copy: 'Copy', copied: 'Copied.', copyFailed: 'Could not copy.',
        chosen: 'You chose', explored: 'Because you explored', discover: 'Explore a different topic', general: 'A starting point for your study',
        signIn: 'Please sign in to request new content.', preferFailed: 'Could not save your preference. Your previous choice was restored.',
        feedbackFailed: 'Could not save your feedback. Please try again.', current: 'Today', marked: 'Selected', savedHelp: 'Saved pieces stay available across days and languages.',
        previous: 'Previous reflection, kept from before this update',
        preferenceConflict: 'Your preferences changed in another tab. The latest choices have been loaded; please review them.',
    },
    af: {
        title: 'Vir Jou', subtitle: 'Skrif, nadenke en iets nuuts om te leer.', daily: 'Vandag se nadenke',
        reading: 'Aanbevole leesstof', loading: 'Jou leesstof word voorberei…', newDaily: 'Nog ’n oordenking', newArticles: 'Nuwe voorstelle',
        retry: 'Probeer weer', saved: 'Gestoorde leesstof', noSaved: 'Stoor ’n artikel om dit later hier te vind.', interests: 'Bestuur my belangstellings',
        interestHelp: 'Kies wat jou interesseer. Uitgeslote onderwerpe word uit alle nuwe voorstelle gelaat.', prefer: 'Verkies', exclude: 'Sluit uit', neutral: 'Outomaties',
        pending: 'Jou voorkeure is gestoor. Werk aanbevelings by om dit toe te pas.', update: 'Werk aanbevelings by',
        empty: 'Geen geskikte onderwerpe nie. Aktiveer ’n belangstelling hieronder om voorstelle te kry.', continue: 'Gaan voort met jou leesplan',
        save: 'Stoor', helpful: 'Nuttig', read: 'Reeds gelees', less: 'Minder hiervan', feedbackHelp: 'Minder hiervan verlaag soortgelyke voorstelle; dit sluit nie die onderwerp permanent uit nie.',
        offline: 'Gestoorde inhoud word gewys. Koppel weer voordat jy inhoud genereer of voorkeure verander.',
        busy: 'Hierdie leesstuk word in ’n ander oortjie voorberei. Probeer binnekort weer.', cooldown: 'Hierdie afdeling kan later verfris word. Jou bestaande leesstof bly behoue.',
        error: 'Kon nie hierdie afdeling laai nie. Jou vorige leesstof bly behoue.', setup: 'Vir Jou kon nie koppel nie. Probeer weer. Die nuwe databasisopstelling is moontlik nog nie voltooi nie.',
        close: 'Sluit', open: 'Lees artikel', passage: 'Lees die gedeelte in die Bybel', copy: 'Kopieer', copied: 'Gekopieer.', copyFailed: 'Kon nie kopieer nie.',
        chosen: 'Jy het gekies', explored: 'Omdat jy ondersoek het', discover: 'Verken ’n ander onderwerp', general: '’n Beginpunt vir jou studie',
        signIn: 'Meld asseblief aan om nuwe inhoud aan te vra.', preferFailed: 'Kon nie jou voorkeur stoor nie. Jou vorige keuse is herstel.',
        feedbackFailed: 'Kon nie jou terugvoer stoor nie. Probeer weer.', current: 'Vandag', marked: 'Gekies', savedHelp: 'Gestoorde leesstof bly oor dae en tale heen beskikbaar.',
        previous: 'Vorige oordenking, behou van voor hierdie opdatering',
        preferenceConflict: 'Jou voorkeure het in ’n ander oortjie verander. Die jongste keuses is gelaai; kyk dit asseblief na.',
    },
};

export default function Blog() {
    const { settings, user, authLoading } = useSettings();
    const language = settings.language === 'af' ? 'af' : 'en';
    const t = WORDS[language];
    const navigate = useNavigate();
    const [ctx, setCtx] = useState(null);
    const [slots, setSlots] = useState({});
    const [pageError, setPageError] = useState(false);
    const [selected, setSelected] = useState(null);
    const [pendingPreferences, setPendingPreferences] = useState(false);
    const [saving, setSaving] = useState(false);
    const [feedbackBusy, setFeedbackBusy] = useState('');
    const [notice, setNotice] = useState('');
    const [saved, setSaved] = useState(null);
    const [savedLoading, setSavedLoading] = useState(false);
    const request = useRef(0);
    const current = useRef(null);
    const refresh = useRef(0);
    const dialog = useRef(null);
    const identity = user?.id || 'guest';

    const applyContext = useCallback(next => { current.current = next; setCtx(next); }, []);

    const fillSlot = useCallback(async (context, spec, force, loadId) => {
        setSlots(previous => ({ ...previous, [spec.slot]: { ...previous[spec.slot], loading: true, status: null } }));
        const result = await getForYouPiece(context, spec, { force });
        if (loadId !== request.current) return;
        setSlots(previous => ({ ...previous, [spec.slot]: { ...result, loading: false } }));
        if (result.content && current.current?.userId === context.userId) {
            const updated = { ...current.current, history: [result.content, ...current.current.history.filter(h => h.id !== result.content.id)].slice(0, 90) };
            applyContext(updated);
        }
    }, [applyContext]);

    const load = useCallback(async () => {
        if (authLoading) return;
        const loadId = ++request.current;
        current.current = null;
        setCtx(null); setSlots({}); setSelected(null); setSaved(null); setPageError(false); setNotice(''); setPendingPreferences(false);
        setSaving(false); setFeedbackBusy(''); setSavedLoading(false);
        try {
            const userId = user?.id || await getUserId();
            if (!user && !userId?.startsWith('user_')) throw new Error('account_changed');
            const next = await getForYouContext(userId, language);
            if (loadId !== request.current) return;
            applyContext(next);
            const plan = getForYouPlan(next);
            setSlots(Object.fromEntries(plan.map(spec => [spec.slot, { content: cachedForSlot(next, spec.slot) || (spec.slot === 'devotional' ? next.legacy : null), loading: true }])));
            // Sections settle independently; a slow article cannot hide a ready devotional.
            plan.forEach(spec => { void fillSlot(next, spec, false, loadId); });
            void logBlogView(userId);
        } catch {
            if (loadId === request.current) setPageError(true);
        }
    }, [authLoading, user, language, applyContext, fillSlot]);

    useEffect(() => { void load(); return () => { request.current++; }; }, [load]);
    useEffect(() => {
        const checkDay = () => {
            if (current.current && localDay(new Date(), current.current.zone) !== current.current.day) void load();
        };
        window.addEventListener('focus', checkDay);
        const interval = setInterval(checkDay, 60000);
        return () => { window.removeEventListener('focus', checkDay); clearInterval(interval); };
    }, [load]);

    useEffect(() => {
        if (!selected) return;
        const previous = document.activeElement;
        const close = () => setSelected(null);
        window.backButtonHandlers?.add(close);
        const keydown = e => { if (e.key === 'Escape') close(); };
        window.addEventListener('keydown', keydown);
        dialog.current?.focus();
        return () => {
            window.backButtonHandlers?.delete(close);
            window.removeEventListener('keydown', keydown);
            previous?.focus?.();
        };
    }, [selected?.id]);

    // Never render an earlier account/language's personal content during an effect transition.
    const visible = ctx && ctx.language === language && (user ? ctx.userId === user.id : ctx.guest);
    const states = visible ? preferenceStates(ctx.prefs.preferences) : {};
    const plan = visible ? getForYouPlan(ctx, refresh.current) : [];
    const allowed = item => item && states[item.topic_id] !== 'exclude';
    const isLoading = Object.values(slots).some(slot => slot.loading);

    const refreshSections = async (which, force = true) => {
        const context = current.current;
        if (!context || saving || isLoading) return;
        if (context.guest && force) { setNotice(t.signIn); navigate('/auth'); return; }
        const loadId = request.current;
        refresh.current++;
        const keep = ['devotional', 'article_1', 'article_2'].filter(slot => !which.includes(slot));
        const specs = getForYouPlan(context, refresh.current, keep).filter(spec => which.includes(spec.slot));
        setPendingPreferences(false);
        await Promise.all(specs.map(spec => fillSlot(context, spec, force, loadId)));
    };

    const changeInterest = async (topicId, state) => {
        const previous = current.current;
        if (!previous || saving) return;
        const loadId = request.current;
        setSaving(true); setNotice('');
        applyContext({ ...previous, prefs: { ...previous.prefs, preferences: { ...previous.prefs.preferences,
            topics: { ...previous.prefs.preferences.topics, [topicId]: state } } } });
        try {
            const prefs = await patchForYouInterest(previous, topicId, state);
            if (loadId !== request.current) return;
            applyContext({ ...current.current, prefs });
            setPendingPreferences(true);
        } catch (error) {
            if (loadId === request.current) {
                applyContext(previous); setNotice(t.preferFailed);
                if (error.message?.includes('preferences_changed_reload')) {
                    try {
                        const latest = await getForYouContext(previous.userId, language);
                        if (loadId === request.current) { applyContext(latest); setNotice(t.preferenceConflict); }
                    } catch { /* keep the previous verified preference state */ }
                }
            }
        } finally { if (loadId === request.current) setSaving(false); }
    };

    const giveFeedback = async (item, field) => {
        if (feedbackBusy) return;
        const context = current.current;
        const loadId = request.current;
        const old = context.feedback[item.id] || item.feedback || {};
        setFeedbackBusy(`${item.id}:${field}`); setNotice('');
        try {
            const value = await setForYouFeedback(context, item.id, field, !old[field]);
            if (loadId !== request.current) return;
            applyContext({ ...current.current, feedback: { ...current.current.feedback, [item.id]: value } });
            if (field === 'saved') setSaved(previous => previous === null ? null
                : value.saved ? [{ ...item, feedback: value }, ...previous.filter(p => p.id !== item.id)]
                    : previous.filter(p => p.id !== item.id));
        } catch { if (loadId === request.current) setNotice(t.feedbackFailed); }
        finally { if (loadId === request.current) setFeedbackBusy(''); }
    };

    const loadSaved = async () => {
        if (!current.current || savedLoading) return;
        const loadId = request.current;
        setSavedLoading(true);
        try {
            const items = await getSavedForYou(current.current);
            if (loadId === request.current) setSaved(items);
        } catch { if (loadId === request.current) setNotice(t.error); }
        finally { if (loadId === request.current) setSavedLoading(false); }
    };

    const reason = item => item.legacy ? t.previous : `${t[item.reason] || t.general}${['chosen', 'explored'].includes(item.reason) ? `: ${topicLabel(item.topic_id, language)}` : ''}`;
    const feedbackButtons = item => item.legacy ? null : <div className="fy-feedback" aria-label={t.feedbackHelp}>
        {['saved', 'helpful', 'read', 'less_like'].map(field => {
            const checked = (ctx.feedback[item.id] || item.feedback || {})[field];
            return <button key={field} type="button" aria-pressed={!!checked} disabled={!!feedbackBusy || ctx.offline}
                onClick={() => giveFeedback(item, field)}>{checked ? '✓ ' : ''}{t[({ saved: 'save', helpful: 'helpful', read: 'read', less_like: 'less' })[field]]}</button>;
        })}
    </div>;
    const passage = item => item.passage && <div className="fy-scripture">
        <button type="button" className="fy-reference" onClick={() => {
            setSelected(null);
            navigate('/bible', { state: { bookId: item.passage.book_id, chapter: item.passage.chapter,
                targetVerse: item.passage.start, fromSearch: true } });
        }} title={t.passage}>{item.passage.reference} · {item.passage.version}</button>
        <blockquote>{item.passage.verses.map(v => <span key={v.verse}><sup>{v.verse}</sup> {v.text}{' '}</span>)}</blockquote>
    </div>;
    const body = item => <div className="fy-body" style={{ fontSize: `${settings.fontSize}px` }}>
        {passage(item)}
        {item.paragraphs.map((paragraph, i) => <p key={i}>{paragraph}</p>)}
        {item.closing && <p className="fy-closing">{item.closing}</p>}
        {feedbackButtons(item)}
    </div>;
    const sectionStatus = (slot, name) => <>
        {slot?.loading && <p className="fy-status" role="status">{t.loading}</p>}
        {slot?.status && ['error', 'busy', 'cooldown'].includes(slot.status) && <div className="fy-inline-error" role="status">
            <p>{t[slot.status]}</p>
            {slot.availableAt && <p>{new Date(slot.availableAt).toLocaleString(language === 'af' ? 'af-ZA' : 'en-ZA')}</p>}
            {slot.status !== 'cooldown' && <button onClick={() => refreshSections([name], slot.status !== 'cooldown')} disabled={slot.loading}>{t.retry}</button>}
        </div>}
    </>;

    return <main className="fy-page" data-identity={identity}>
        <header className="fy-header"><h1>{t.title}</h1><p>{t.subtitle}</p></header>
        <div className="fy-notice" aria-live="polite">{notice}</div>
        {!visible && !pageError && <p className="fy-status" role="status">{t.loading}</p>}
        {pageError && <div className="fy-inline-error"><p>{t.setup}</p><button onClick={load}>{t.retry}</button></div>}
        {visible && <>
            {ctx.offline && <p className="fy-banner">{t.offline}</p>}
            {pendingPreferences && <div className="fy-banner"><p>{t.pending}</p><button disabled={isLoading || saving}
                onClick={() => refreshSections(['devotional', 'article_1', 'article_2'], false)}>{t.update}</button></div>}
            {!plan.length && <p className="fy-banner">{t.empty}</p>}
            <section className="fy-section" aria-labelledby="fy-daily">
                <div className="fy-section-heading"><h2 id="fy-daily">{t.daily}</h2><button onClick={() => refreshSections(['devotional'])}
                    disabled={isLoading || saving || ctx.offline || !plan.length}>{t.newDaily}</button></div>
                {sectionStatus(slots.devotional, 'devotional')}
                {allowed(slots.devotional?.content) && <article className="fy-devotional">
                    <span className="fy-format">{formatLabel(slots.devotional.content.format_id, language)}</span>
                    <h3>{slots.devotional.content.title}</h3>
                    <p className="fy-reason">{reason(slots.devotional.content)}</p>
                    {body(slots.devotional.content)}
                </article>}
            </section>
            {ctx.activePlan?.reading_plans?.slug && <section className="fy-continue">
                <div><h2>{t.continue}</h2><p>{language === 'af' ? ctx.activePlan.reading_plans.title_af || ctx.activePlan.reading_plans.title : ctx.activePlan.reading_plans.title}</p></div>
                <button onClick={() => navigate(`/plans/${ctx.activePlan.reading_plans.slug}`)}>{t.continue}</button>
            </section>}
            <section className="fy-section" aria-labelledby="fy-reading">
                <div className="fy-section-heading"><h2 id="fy-reading">{t.reading}</h2><button onClick={() => refreshSections(['article_1', 'article_2'])}
                    disabled={isLoading || saving || ctx.offline || !plan.length}>{t.newArticles}</button></div>
                <div className="fy-grid">{['article_1', 'article_2'].map(name => <div key={name}>
                    {sectionStatus(slots[name], name)}
                    {allowed(slots[name]?.content) && <article className="fy-card">
                        <span className="fy-format">{formatLabel(slots[name].content.format_id, language)}</span>
                        <h3>{slots[name].content.title}</h3><p>{slots[name].content.summary}</p>
                        <p className="fy-reason">{reason(slots[name].content)}</p>
                        <button className="fy-primary" onClick={() => setSelected(slots[name].content)}>{t.open}</button>
                        {feedbackButtons(slots[name].content)}
                    </article>}
                </div>)}</div>
                <p className="fy-help">{t.feedbackHelp}</p>
            </section>
            <details className="fy-details" onToggle={e => { if (e.currentTarget.open && saved === null) void loadSaved(); }}>
                <summary>{t.saved}</summary><p className="fy-help">{t.savedHelp}</p>
                {savedLoading ? <p role="status">{t.loading}</p> : saved?.length ? <ul className="fy-saved-list">{saved.map(item => <li key={item.id}><button onClick={() => setSelected(item)}>{item.title} · {item.language.toUpperCase()}</button></li>)}</ul> : <p>{t.noSaved}</p>}
            </details>
            <details className="fy-details">
                <summary>{t.interests}</summary><p>{t.interestHelp}</p>
                <div className="fy-interests">{FOR_YOU_TOPICS.filter(topic => DEFAULT_TOPIC_IDS.includes(topic.id) || ctx.interests.some(i => i.id === topic.id)
                    || Object.hasOwn(states, topic.id) || !topic.id.startsWith('book_')).map(topic => <label key={topic.id}>
                    <span>{topicLabel(topic.id, language)}</span><select value={states[topic.id] || 'neutral'} disabled={saving || isLoading || ctx.offline}
                        onChange={e => changeInterest(topic.id, e.target.value)}>
                        <option value="neutral">{t.neutral}</option><option value="prefer">{t.prefer}</option><option value="exclude">{t.exclude}</option>
                    </select>
                </label>)}</div>
            </details>
        </>}
        {visible && selected && <div className="fy-modal-overlay" onClick={() => setSelected(null)}>
            <section className="fy-modal" role="dialog" aria-modal="true" aria-labelledby="fy-article-title" ref={dialog} tabIndex={-1}
                onClick={e => e.stopPropagation()} onKeyDown={e => {
                    if (e.key !== 'Tab') return;
                    const buttons = dialog.current.querySelectorAll('button:not(:disabled),a[href],select:not(:disabled),[tabindex="0"]');
                    const first = buttons[0], last = buttons[buttons.length - 1];
                    if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { e.preventDefault(); last?.focus(); }
                    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
                }}>
                <div className="fy-modal-heading"><span className="fy-format">{formatLabel(selected.format_id, language)}</span>
                    <button onClick={() => setSelected(null)}>{t.close}</button></div>
                <h2 id="fy-article-title">{selected.title}</h2>{body(selected)}
                <button onClick={async () => {
                    const text = [selected.title, selected.passage ? `${selected.passage.reference} (${selected.passage.version})` : '',
                        selected.passage?.verses.map(v => `${v.verse} ${v.text}`).join(' ') || '', ...selected.paragraphs, selected.closing].filter(Boolean).join('\n\n');
                    setNotice(await copyToClipboard(text) ? t.copied : t.copyFailed);
                }}>{t.copy}</button>
            </section>
        </div>}
    </main>;
}
