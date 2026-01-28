/**
 * VerseActionSheet - Bottom sheet for verse actions
 * Shows when user taps a verse
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { HIGHLIGHT_COLORS } from '../services/highlightService';
import { useSettings } from '../context/SettingsContext';
import TutorialOverlay from './TutorialOverlay';
import { useBackButton } from './BackButtonHandler';
import { copyToClipboard } from '../utils/appUtils';
import './VerseActionSheet.css';

function VerseActionSheet({
    verse,
    verseText,
    verseRef,
    currentColor,
    categories,
    onHighlight,
    onSaveCategory,
    onNote,
    onStudy,
    onWordStudy,
    onCopy,
    onShare,
    onClose
}) {
    const navigate = useNavigate();
    const { settings } = useSettings();
    const [copied, setCopied] = useState(false);

    // Close on Android back button
    const handleBackClose = useCallback(() => {
        onClose();
    }, [onClose]);
    useBackButton(true, handleBackClose);
    const [editingColor, setEditingColor] = useState(null); // color hex being renamed
    const [tempLabel, setTempLabel] = useState('');
    const [showHelp, setShowHelp] = useState(false);
    const [isTutorialOpen, setIsTutorialOpen] = useState(false);
    const [isTutorialMode, setIsTutorialMode] = useState(false);
    const [tutorialStepIdx, setTutorialStepIdx] = useState(0);

    const isAfrikaans = settings.language === 'af';

    const translations = {
        en: {
            note: "Note",
            wordStudy: "Word Study",
            study: "Study",
            copy: "Copy",
            copied: "Copied!",
            renamePlaceholder: "Name this color (e.g. Faith)",
            save: "Save",
            mobileHint: "Long press a color to name it",
            pcHint: "Right click a color to name it",
            multiTagTitle: "Multi-Topic Tagging",
            multiTagDesc: "Use a comma to add multiple labels (e.g. 'Faith, Hope'). The verse will appear under each label in your Profile."
        },
        af: {
            note: "Nota",
            wordStudy: "Woordstudie",
            study: "Bestudeer",
            copy: "Kopieer",
            copied: "Gekopieer!",
            renamePlaceholder: "Gee kleur 'n naam (bv. Geloof)",
            save: "Stoor",
            mobileHint: "Druk lank op 'n kleur om dit te benoem",
            pcHint: "Regskliek op 'n kleur om dit te benoem",
            multiTagTitle: "Veelvuldige Onderwerpe",
            multiTagDesc: "Gebruik 'n komma vir meer as een etiket (bv. 'Geloof, Hoop'). Die vers sal onder elke etiket in jou Profiel verskyn."
        }
    };

    const tutorialSteps = [
        {
            target: '.action-sheet',
            title: isAfrikaans ? 'Vers-aksies' : 'Verse Actions',
            content: isAfrikaans
                ? 'Hier kan jy verse merk, notas maak of woordstudies bekyk.'
                : 'Highlight verses, take notes, or view word studies from here.'
        },
        {
            target: '#tutorial-btn-note',
            title: isAfrikaans ? 'Notas' : 'Notes',
            content: isAfrikaans
                ? 'Klik hier om jou eie notas by hierdie spesifieke vers te voeg.'
                : 'Click here to add your own personal notes to this specific verse.'
        },
        {
            target: '#tutorial-btn-wordstudy',
            title: isAfrikaans ? 'Woord-studie' : 'Word Study',
            content: isAfrikaans
                ? 'Kyk na die oorspronklike Griekse of Hebreeuse betekenis.'
                : 'Explore the original Greek or Hebrew meanings of the words.'
        },
        {
            target: '#tutorial-btn-study',
            title: isAfrikaans ? 'Versamelings' : 'Collections',
            content: isAfrikaans
                ? 'Voeg die vers by jou eie temas of preek-voorbeidings.'
                : 'Add the verse to your own themes or sermon preparations.'
        },
        {
            target: '#tutorial-btn-copy',
            title: isAfrikaans ? 'Kopieer' : 'Copy',
            content: isAfrikaans
                ? 'Kopieer die Bybelteks vinnig om dit elders te gebruik.'
                : 'Quickly copy the Bible text to use it elsewhere.'
        },
        {
            target: '#tutorial-btn-share',
            title: isAfrikaans ? 'Deel' : 'Share',
            content: isAfrikaans
                ? 'Skep \'n pragtige beeld en deel dit op sosiale media.'
                : 'Create a beautiful image and share it on social media.'
        },
        {
            target: '.color-picker-row',
            title: isAfrikaans ? 'Merk' : 'Highlights',
            content: isAfrikaans
                ? 'Kies \'n kleur om te merk. Regskliek (PC) of druk lank (Mobile) op \'n kleur om dit te benoem!'
                : 'Pick a color to highlight. Right-click (PC) or Long-press (Mobile) a color to name it!'
        },
        {
            target: '.action-sheet-ref',
            title: isAfrikaans ? 'Argief' : 'Archive',
            content: isAfrikaans
                ? 'Al jou werk word in jou Profiel bewaar. Kom ons gaan kyk!'
                : 'All your work is saved in your Profile. Let\'s go see!'
        }
    ];

    const t = translations[settings.language] || translations.en;

    const handleCopy = async () => {
        const textToCopy = verseText ? `${verseText} - ${verseRef}` : verseRef;
        const success = await copyToClipboard(textToCopy);
        if (success) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            onCopy && onCopy();
        }
    };

    const [longPressTimer, setLongPressTimer] = useState(null);

    const handleTouchStart = (color) => {
        // Start a timer for 600ms to detect long press
        const timer = setTimeout(() => {
            setEditingColor(color);
            setTempLabel(categories[color] || '');
            setLongPressTimer(null);
        }, 600);
        setLongPressTimer(timer);
    };

    const handleTouchEnd = () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            setLongPressTimer(null);
        }
    };

    const handleColorSelect = (color) => {
        // If we were about to trigger a long press, cancel it
        handleTouchEnd();

        if (currentColor === color) {
            onHighlight(null);
        } else {
            onHighlight(color);
        }
    };

    const startEditing = (color, e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        setEditingColor(color);
        setTempLabel(categories[color] || '');
    };

    const saveLabel = () => {
        onSaveCategory(editingColor, tempLabel);
        setEditingColor(null);
    };

    return (
        <>
            <div className="action-sheet-overlay" onClick={onClose}>
                <div className="action-sheet" onClick={(e) => e.stopPropagation()}>
                    {/* Header: Toggle, Handle, and Exit */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', padding: '0 5px' }}>
                        <div className="tutorial-toggle-container">
                            <label className="tutorial-toggle-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={isTutorialMode}
                                    onChange={(e) => {
                                        const active = e.target.checked;
                                        setIsTutorialMode(active);
                                        setIsTutorialOpen(active);
                                        if (active) setTutorialStepIdx(0);
                                    }}
                                />
                                {isAfrikaans ? 'Handleiding' : 'Tutorial'}
                            </label>
                        </div>

                        <div className="action-sheet-handle" style={{ margin: '0' }} />

                        <button className="action-sheet-close" onClick={onClose} aria-label="Close" style={{ position: 'static' }}>
                            ✕
                        </button>
                    </div>

                    {/* Verse reference */}
                    <div className="action-sheet-ref">{verseRef}</div>

                    {/* Color picker */}
                    <div className="color-picker-row">
                        {HIGHLIGHT_COLORS.map(({ name, color }) => (
                            <div key={color} className="color-btn-container">
                                <button
                                    className={`color-btn ${currentColor === color ? 'active' : ''}`}
                                    style={{ backgroundColor: color }}
                                    onClick={() => handleColorSelect(color)}
                                    onContextMenu={(e) => startEditing(color, e)}
                                    onTouchStart={() => handleTouchStart(color)}
                                    onTouchEnd={handleTouchEnd}
                                    onTouchMove={handleTouchEnd}
                                    aria-label={`Highlight ${name}`}
                                >
                                    {currentColor === color && <span className="color-check">✓</span>}
                                </button>
                                {categories[color] && (
                                    <span className="color-label-hint">{categories[color]}</span>
                                )}
                            </div>
                        ))}
                        {/* Clear button */}
                        {currentColor && (
                            <button
                                className={`color-btn clear-btn`}
                                onClick={() => onHighlight(null)}
                                aria-label="Remove highlight"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Renaming UI */}
                    {editingColor ? (
                        <div className="category-edit-row">
                            <div className="edit-dot" style={{ backgroundColor: editingColor }} />
                            <input
                                type="text"
                                value={tempLabel}
                                onChange={(e) => setTempLabel(e.target.value)}
                                placeholder={t.renamePlaceholder}
                                className="category-label-input"
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && saveLabel()}
                            />
                            <button className="category-save-btn" onClick={saveLabel}>{t.save}</button>
                            <button className="category-cancel-btn" onClick={() => setEditingColor(null)}>✕</button>
                        </div>
                    ) : (
                        <div className="color-naming-hint">
                            <span>
                                {window.matchMedia('(pointer: coarse)').matches
                                    ? t.mobileHint
                                    : t.pcHint}
                            </span>
                            <button
                                className={`help-info-btn ${showHelp ? 'active' : ''}`}
                                onClick={() => setShowHelp(!showHelp)}
                                title="Help"
                            >
                                ⓘ
                            </button>
                        </div>
                    )}

                    {showHelp && !editingColor && (
                        <div className="contextual-help-box">
                            <h4>{t.multiTagTitle} 🏷️</h4>
                            <p>{t.multiTagDesc}</p>
                        </div>
                    )}

                    {/* Action buttons */}
                    <div className="action-buttons">
                        <button className="action-btn" id="tutorial-btn-note" onClick={onNote}>
                            <span className="action-icon">📝</span>
                            <span className="action-label">{t.note}</span>
                        </button>
                        <button className="action-btn" id="tutorial-btn-wordstudy" onClick={onWordStudy}>
                            <span className="action-icon">📜</span>
                            <span className="action-label">{t.wordStudy}</span>
                        </button>
                        <button className="action-btn" id="tutorial-btn-study" onClick={onStudy}>
                            <span className="action-icon">📖</span>
                            <span className="action-label">{t.study}</span>
                        </button>
                        <button className="action-btn" id="tutorial-btn-copy" onClick={handleCopy}>
                            <span className="action-icon">{copied ? '✓' : '📋'}</span>
                            <span className="action-label">{copied ? t.copied : t.copy}</span>
                        </button>
                        <button className="action-btn" id="tutorial-btn-share" onClick={onShare}>
                            <span className="action-icon">🖼️</span>
                            <span className="action-label">{isAfrikaans ? 'Deel' : 'Share'}</span>
                        </button>
                    </div>
                </div>
            </div>

            <TutorialOverlay
                isOpen={isTutorialOpen}
                steps={tutorialSteps}
                language={settings.language}
                externalStepIdx={tutorialStepIdx}
                onNext={(idx) => {
                    // If it's the last step and they click Next, go to Profile
                    if (idx === tutorialSteps.length - 1) {
                        setIsTutorialOpen(false);
                        setIsTutorialMode(false);
                        localStorage.setItem('profile_tutorial_trigger', 'true');
                        onClose(); // Close the sheet
                        navigate('/profile');
                        return;
                    }
                    setTutorialStepIdx(idx + 1);
                }}
                onComplete={() => {
                    setIsTutorialOpen(false);
                    setIsTutorialMode(false);
                }}
            />
        </>
    );
}

export default VerseActionSheet;
