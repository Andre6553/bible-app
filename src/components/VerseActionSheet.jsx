/**
 * VerseActionSheet - Bottom sheet for verse actions
 * Shows when user taps a verse
 */

import { useState } from 'react';
import { HIGHLIGHT_COLORS } from '../services/highlightService';
import { useSettings } from '../context/SettingsContext';
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
    onClose
}) {
    const { settings } = useSettings();
    const [copied, setCopied] = useState(false);
    const [editingColor, setEditingColor] = useState(null); // color hex being renamed
    const [tempLabel, setTempLabel] = useState('');

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
            pcHint: "Right click a color to name it"
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
            pcHint: "Regskliek op 'n kleur om dit te benoem"
        }
    };

    const t = translations[settings.language] || translations.en;

    const handleCopy = async () => {
        const textToCopy = verseText ? `${verseText} - ${verseRef}` : verseRef;
        try {
            await navigator.clipboard.writeText(textToCopy);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            onCopy && onCopy();
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const handleColorSelect = (color) => {
        if (currentColor === color) {
            // Remove highlight if same color tapped
            onHighlight(null);
        } else {
            onHighlight(color);
        }
    };

    const startEditing = (color, e) => {
        e.preventDefault();
        e.stopPropagation();
        setEditingColor(color);
        setTempLabel(categories[color] || '');
    };

    const saveLabel = () => {
        onSaveCategory(editingColor, tempLabel);
        setEditingColor(null);
    };

    return (
        <div className="action-sheet-overlay" onClick={onClose}>
            <div className="action-sheet" onClick={(e) => e.stopPropagation()}>
                {/* Handle bar */}
                <div className="action-sheet-handle" />

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
                            className="color-btn clear-btn"
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
                        {window.matchMedia('(pointer: coarse)').matches
                            ? t.mobileHint
                            : t.pcHint}
                    </div>
                )}

                {/* Action buttons */}
                <div className="action-buttons">
                    <button className="action-btn" onClick={onNote}>
                        <span className="action-icon">📝</span>
                        <span className="action-label">{t.note}</span>
                    </button>
                    <button className="action-btn" onClick={onWordStudy}>
                        <span className="action-icon">📜</span>
                        <span className="action-label">{t.wordStudy}</span>
                    </button>
                    <button className="action-btn" onClick={onStudy}>
                        <span className="action-icon">📖</span>
                        <span className="action-label">{t.study}</span>
                    </button>
                    <button className="action-btn" onClick={handleCopy}>
                        <span className="action-icon">{copied ? '✓' : '📋'}</span>
                        <span className="action-label">{copied ? t.copied : t.copy}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

export default VerseActionSheet;
