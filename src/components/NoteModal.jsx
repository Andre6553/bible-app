/**
 * NoteModal - Full screen modal for adding/editing verse notes
 */

import { useState, useEffect } from 'react';
import { getStudyCollections, createStudyCollection, getLabels, createLabel } from '../services/highlightService';
import './NoteModal.css';

function NoteModal({
    verse,
    verseText,
    verseRef,
    existingNote,
    onSave,
    onClose
}) {
    const [noteText, setNoteText] = useState(existingNote?.note_text || '');
    const [collections, setCollections] = useState([]);
    const [labels, setLabels] = useState([]);
    const [selectedStudy, setSelectedStudy] = useState(existingNote?.study_id || null);
    const [selectedLabels, setSelectedLabels] = useState([]);
    const [showNewStudy, setShowNewStudy] = useState(false);
    const [newStudyName, setNewStudyName] = useState('');
    const [showNewLabel, setShowNewLabel] = useState(false);
    const [newLabelName, setNewLabelName] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const [studyRes, labelRes] = await Promise.all([
            getStudyCollections(),
            getLabels()
        ]);
        if (studyRes.success) setCollections(studyRes.collections);
        if (labelRes.success) setLabels(labelRes.labels);

        // Set existing labels if editing
        if (existingNote?.note_labels) {
            const existingLabelIds = existingNote.note_labels.map(nl => nl.user_labels?.id).filter(Boolean);
            setSelectedLabels(existingLabelIds);
        }
    };

    const handleSave = async () => {
        if (!noteText.trim()) return;
        setSaving(true);
        await onSave(noteText, selectedStudy, selectedLabels);
        setSaving(false);
    };

    const handleCreateStudy = async () => {
        if (!newStudyName.trim()) return;
        const result = await createStudyCollection(newStudyName.trim());
        if (result.success) {
            setCollections([result.collection, ...collections]);
            setSelectedStudy(result.collection.id);
            setNewStudyName('');
            setShowNewStudy(false);
        }
    };

    const handleCreateLabel = async () => {
        if (!newLabelName.trim()) return;
        const result = await createLabel(newLabelName.trim());
        if (result.success) {
            setLabels([...labels, result.label]);
            setSelectedLabels([...selectedLabels, result.label.id]);
            setNewLabelName('');
            setShowNewLabel(false);
        }
    };

    const toggleLabel = (labelId) => {
        if (selectedLabels.includes(labelId)) {
            setSelectedLabels(selectedLabels.filter(id => id !== labelId));
        } else {
            setSelectedLabels([...selectedLabels, labelId]);
        }
    };

    return (
        <div className="note-modal-overlay">
            <div className="note-modal">
                {/* Header */}
                <div className="note-modal-header">
                    <button className="note-back-btn" onClick={onClose}>←</button>
                    <h2>Note</h2>
                    <button
                        className="note-save-btn"
                        onClick={handleSave}
                        disabled={!noteText.trim() || saving}
                    >
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                </div>

                {/* Content */}
                <div className="note-modal-content">
                    {/* Text input */}
                    <textarea
                        className="note-textarea"
                        placeholder="What would you like to say?"
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        autoFocus
                    />

                    {/* Verse preview */}
                    <div className="note-verse-preview">
                        <div className="verse-accent-bar" />
                        <div className="verse-preview-content">
                            <p className="verse-preview-text">{verseText}</p>
                            <p className="verse-preview-ref">{verseRef}</p>
                        </div>
                    </div>

                    {/* Study collection selector */}
                    <div className="note-section">
                        <h3>📚 Add to Study</h3>
                        <div className="study-list">
                            {collections.map(study => (
                                <button
                                    key={study.id}
                                    className={`study-chip ${selectedStudy === study.id ? 'active' : ''}`}
                                    style={{ '--chip-color': study.color }}
                                    onClick={() => setSelectedStudy(selectedStudy === study.id ? null : study.id)}
                                >
                                    {study.name}
                                </button>
                            ))}
                            {showNewStudy ? (
                                <div className="new-chip-input">
                                    <input
                                        type="text"
                                        placeholder="Study name..."
                                        value={newStudyName}
                                        onChange={(e) => setNewStudyName(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleCreateStudy()}
                                        autoFocus
                                    />
                                    <button onClick={handleCreateStudy}>✓</button>
                                    <button onClick={() => setShowNewStudy(false)}>✕</button>
                                </div>
                            ) : (
                                <button className="add-chip-btn" onClick={() => setShowNewStudy(true)}>
                                    + New Study
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Labels */}
                    <div className="note-section">
                        <h3>🏷️ Labels</h3>
                        <div className="label-list">
                            {labels.map(label => (
                                <button
                                    key={label.id}
                                    className={`label-chip ${selectedLabels.includes(label.id) ? 'active' : ''}`}
                                    onClick={() => toggleLabel(label.id)}
                                >
                                    {label.name}
                                </button>
                            ))}
                            {showNewLabel ? (
                                <div className="new-chip-input">
                                    <input
                                        type="text"
                                        placeholder="Label name..."
                                        value={newLabelName}
                                        onChange={(e) => setNewLabelName(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleCreateLabel()}
                                        autoFocus
                                    />
                                    <button onClick={handleCreateLabel}>✓</button>
                                    <button onClick={() => setShowNewLabel(false)}>✕</button>
                                </div>
                            ) : (
                                <button className="add-chip-btn" onClick={() => setShowNewLabel(true)}>
                                    + Add Label
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default NoteModal;
