/**
 * VerseActionSheet - Bottom sheet for verse actions
 * Shows when user taps a verse
 */

import { useState } from 'react';
import { HIGHLIGHT_COLORS } from '../services/highlightService';
import './VerseActionSheet.css';

function VerseActionSheet({
    verse,
    verseText,
    verseRef,
    currentColor,
    onHighlight,
    onNote,
    onCopy,
    onClose
}) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        const textToCopy = `${verseText} - ${verseRef}`;
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
                        <button
                            key={name}
                            className={`color-btn ${currentColor === color ? 'active' : ''}`}
                            style={{ backgroundColor: color }}
                            onClick={() => handleColorSelect(color)}
                            aria-label={`Highlight ${name}`}
                        >
                            {currentColor === color && <span className="color-check">✓</span>}
                        </button>
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

                {/* Action buttons */}
                <div className="action-buttons">
                    <button className="action-btn" onClick={onNote}>
                        <span className="action-icon">📝</span>
                        <span className="action-label">Note</span>
                    </button>
                    <button className="action-btn" onClick={handleCopy}>
                        <span className="action-icon">{copied ? '✓' : '📋'}</span>
                        <span className="action-label">{copied ? 'Copied!' : 'Copy'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

export default VerseActionSheet;
