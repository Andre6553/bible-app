import React from 'react';
import './BibleReader.css'; // Reuse existing modal styles

const OmniDefinitionModal = ({ onClose }) => {
    return (
        <div className="book-selector-modal" onClick={onClose}>
            <div className="book-selector-content info-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>What does "Omni" mean?</h2>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>

                <div className="modal-body info-body">
                    <div className="info-section">
                        <p style={{ fontSize: '1.1rem', marginBottom: '15px' }}>
                            <strong>"Omni"</strong> comes from Latin and means <strong>"All"</strong> or <strong>"Everything"</strong>.
                        </p>
                        <p>So, <strong>Omni Bible</strong> effectively means:</p>

                        <ul style={{ listStyleType: 'disc', paddingLeft: '20px', marginTop: '10px' }}>
                            <li style={{ marginBottom: '10px' }}>
                                <strong>The Complete Bible App:</strong> It has everything in one place—reading, search, AI research, and original language study.
                            </li>
                            <li style={{ marginBottom: '10px' }}>
                                <strong>Universal:</strong> It covers everything from simple reading to deep scholarly analysis.
                            </li>
                            <li style={{ marginBottom: '10px' }}>
                                <strong>All-Encompassing:</strong> It brings together multiple versions (English/Afrikaans), Old & New Testaments, and modern technology.
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OmniDefinitionModal;
