import React from 'react';
import './Search.css'; // Re-use search styling or add new modal styles here

const SearchHelpModal = ({ onClose, language }) => {

    const content = {
        en: {
            title: "How to use Search & AI",
            searchTitle: "🔍 Search Features",
            searchTips: [
                "**Keywords:** Type words like 'love', 'faith', or 'salvation'.",
                "**Direct Verse:** Typing 'John 3:16' will take you directly to the verse.",
                "**Multi-Word:** Use commas to find verses containing ANY of the words. Example: 'grace, mercy' finds verses with either word.",
                "**Exact Phrase:** Just type the phrase naturally, e.g., 'kingdom of God'."
            ],
            aiTitle: "🤖 AI Research Tools",
            aiDesc: "Use the 'Ask AI' button or type these shortcuts directly in the search bar:",
            shortcuts: [
                { cmd: "/story [topic]", desc: "Tell the complete biblical story of..." },
                { cmd: "/mean [word]", desc: "What is the biblical meaning of..." },
                { cmd: "/explain [topic]", desc: "Explain deep theological concepts..." },
                { cmd: "/who [person]", desc: "Who was this person?" },
                { cmd: "/verse [ref]", desc: "Get an AI commentary on a specific verse." }
            ],
            close: "Close"
        },
        af: {
            title: "Hoe om Soektog & AI te gebruik",
            searchTitle: "🔍 Soek Funksies",
            searchTips: [
                "**Sleutelwoorde:** Tik woorde soos 'liefde', 'geloof', of 'redding'.",
                "**Direkte Vers:** Tik 'Johannes 3:16' om direk na die vers te gaan.",
                "**Veelvuldige Woorde:** Gebruik kommas om verse te vind wat ENIGE van die woorde bevat. Byvoorbeeld: 'genade, barmhartigheid'.",
                "**Presiese Frase:** Tik net die frase natuurlik, bv., 'koninkryk van God'."
            ],
            aiTitle: "🤖 AI Navorsing Gereedskap",
            aiDesc: "Gebruik die 'Vra AI' knoppie of tik hierdie kortpaaie direk in die soekbalk:",
            shortcuts: [
                { cmd: "/story [onderwerp]", desc: "Vertel die volledige bybelse verhaal van..." },
                { cmd: "/mean [woord]", desc: "Wat is die bybelse betekenis van..." },
                { cmd: "/explain [onderwerp]", desc: "Verduidelik diep teologiese konsepte..." },
                { cmd: "/who [persoon]", desc: "Wie was hierdie persoon?" },
                { cmd: "/verse [verw]", desc: "Kry 'n AI kommentaar op 'n spesifieke vers." }
            ],
            close: "Maak Toe"
        }
    };

    const text = content[language] || content.en;

    return (
        <div className="book-selector-modal" onClick={onClose}>
            <div className="book-selector-content info-modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{text.title}</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div className="modal-body info-modal-body">
                    <section className="info-section">
                        <h3>{text.searchTitle}</h3>
                        <ul className="info-list">
                            {text.searchTips.map((tip, i) => {
                                const [bold, rest] = tip.split('**:', 2);
                                return (
                                    <li key={i}>
                                        {rest ? <strong>{bold.replace('**', '')}:</strong> : tip} {rest}
                                    </li>
                                );
                            })}
                        </ul>
                    </section>

                    <div className="divider"></div>

                    <section className="info-section">
                        <h3>{text.aiTitle}</h3>
                        <p>{text.aiDesc}</p>
                        <div className="shortcut-grid">
                            {text.shortcuts.map((s, i) => (
                                <div key={i} className="shortcut-card">
                                    <code className="cmd">{s.cmd}</code>
                                    <span className="desc">{s.desc}</span>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>

                <div className="modal-footer">
                    <button className="action-btn" onClick={onClose}>{text.close}</button>
                </div>
            </div>
        </div>
    );
};

export default SearchHelpModal;
