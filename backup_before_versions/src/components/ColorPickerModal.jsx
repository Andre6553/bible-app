import { useState, useEffect, useRef } from 'react';
import { HIGHLIGHT_COLORS, getHighlightCategories, saveHighlightCategory } from '../services/highlightService';
import './ColorPickerModal.css';

/* 
 * Inline styles backup if css file update fails or for quick reference: 
 * .modal-footer-actions { display: flex; flex-direction: column; align-items: center; gap: 10px; margin-top: 20px; width: 100%; }
 * .remove-highlight-btn { background: transparent; border: 1px solid var(--border-color); color: var(--text-secondary); padding: 8px 16px; border-radius: 20px; cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 0.9em; transition: all 0.2s; }
 * .remove-highlight-btn:hover { background: rgba(255, 59, 48, 0.1); color: #ff3b30; border-color: #ff3b30; }
 */

function ColorPickerModal({ isOpen, onClose, onSelectColor, initialColor, allowNaming = true, language = 'en' }) {
    const [categories, setCategories] = useState({});
    const [longPressTimer, setLongPressTimer] = useState(null);
    const [editingColor, setEditingColor] = useState(null);
    const [tempLabel, setTempLabel] = useState('');
    const [showHelp, setShowHelp] = useState(false);
    const isLongPressRef = useRef(false);
    const modalRef = useRef(null);

    const translations = {
        en: {
            title: "Highlight Colors",
            renamePlaceholder: "Name this color (e.g. Faith)",
            save: "Save",
            mobileHint: "Long press a color to name it",
            pcHint: "Right click a color to name it",
            multiTagTitle: "Multi-Topic Tagging",
            multiTagDesc: "Use a comma to add multiple labels (e.g. 'Faith, Hope'). The verse will appear under each label in your Profile."
        },
        af: {
            title: "Verligkleure",
            renamePlaceholder: "Gee kleur 'n naam (bv. Geloof)",
            save: "Stoor",
            mobileHint: "Druk lank op 'n kleur om dit te benoem",
            pcHint: "Regskliek op 'n kleur om dit te benoem",
            multiTagTitle: "Veelvuldige Onderwerpe",
            multiTagDesc: "Gebruik 'n komma vir meer as een etiket (bv. 'Geloof, Hoop'). Die vers sal onder elke etiket in jou Profiel verskyn."
        }
    };

    const t = translations[language] || translations.en;

    useEffect(() => {
        if (isOpen) {
            loadCategories();
        }
    }, [isOpen]);

    const loadCategories = async () => {
        const result = await getHighlightCategories();
        if (result.success) {
            setCategories(result.categories);
        }
    };

    const handleTouchStart = (colorObj) => {
        if (!allowNaming) return;
        isLongPressRef.current = false; // Reset
        const timer = setTimeout(() => {
            isLongPressRef.current = true; // Mark as long press
            handleRename(colorObj);
        }, 800); // 800ms long press
        setLongPressTimer(timer);
    };

    const handleTouchEnd = () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            setLongPressTimer(null);
        }
    };

    const handleRename = (colorObj) => {
        if (longPressTimer) clearTimeout(longPressTimer);
        setEditingColor(colorObj);
        // Pre-fill with existing name or category
        setTempLabel(categories[colorObj.color] || colorObj.name || '');
    };

    const saveLabel = async () => {
        if (!editingColor) return;
        const newLabel = tempLabel.trim();

        if (newLabel) {
            const result = await saveHighlightCategory(editingColor.color, newLabel);
            if (result.success) {
                setCategories(prev => ({ ...prev, [editingColor.color]: newLabel }));
            }
        }
        setEditingColor(null);
        setTempLabel('');
    };

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (modalRef.current && !modalRef.current.contains(event.target)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="color-picker-overlay">
            <div className="color-picker-modal" ref={modalRef}>
                <div className="color-picker-header">
                    <h3>{t.title}</h3>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>
                <div className="color-grid">
                    {HIGHLIGHT_COLORS.map((c) => (
                        <div key={c.color} className="color-item-wrapper">
                            <button
                                className={`color-btn ${initialColor === c.color ? 'selected' : ''}`}
                                style={{ backgroundColor: c.color }}
                                onClick={() => {
                                    if (isLongPressRef.current) {
                                        isLongPressRef.current = false;
                                        return;
                                    }
                                    onSelectColor(c.color);
                                }}
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    if (allowNaming) handleRename(c);
                                }}
                                onTouchStart={() => handleTouchStart(c)}
                                onTouchEnd={handleTouchEnd}
                                title={categories[c.color] || c.name}
                            >
                                {initialColor === c.color && <span className="check-mark">✓</span>}
                            </button>
                            <span className="color-label">
                                {categories[c.color] || c.name}
                            </span>
                        </div>
                    ))}
                </div>
                <div className="modal-footer-actions">
                    {editingColor ? (
                        <div className="category-edit-row">
                            <div className="edit-dot" style={{ backgroundColor: editingColor.color }} />
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
                        <>
                            <button
                                className="remove-highlight-btn"
                                onClick={() => onSelectColor('REMOVE')}
                            >
                                🚫 Remove Highlight
                            </button>
                            {allowNaming && (
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
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ColorPickerModal;
