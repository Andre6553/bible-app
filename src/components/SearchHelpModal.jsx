import React from 'react';
import './Search.css'; // Re-use search styling or add new modal styles here

const SearchHelpModal = ({ onClose, language }) => {

    const content = {
        en: {
            title: "How to use Search & AI",
            searchTitle: "🔍 Search Modes",
            searchDesc: "Choose the mode that fits your needs best:",
            modes: [
                {
                    name: "Exact Match",
                    desc: "Finds verses containing the specific words or phrases you type. Perfect for finding a direct verse or a specific keyword like 'grace' or 'psalm 23'."
                },
                {
                    name: "Concept Search (AI)",
                    desc: "Finds verses based on the meaning, theme, or feeling of your query. Great for questions like 'how to handle anxiety' or 'God's promises for the future' even if those exact words aren't in the verse."
                }
            ],
            searchTipsTitle: "💡 Search Tips",
            searchTips: [
                "**Direct Verse:** Typing 'John 3:16' (or 'Johannes 3:16' in Afrikaans) will take you directly to the verse regardless of mode.",
                "**Multi-Word:** In Exact Match, use commas to find verses containing ANY of the words. Example: 'grace, mercy'.",
                "**Phrases:** Type a full phrase naturally, e.g., 'kingdom of God' to find exact occurrences."
            ],
            aiTitle: "🤖 AI Research Lab",
            aiDesc: "Use the 'Ask AI' button or type these lightning shortcuts for deep biblical study:",
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
            searchTitle: "🔍 Soek Metodes",
            searchDesc: "Kies die metode wat die beste by jou behoeftes pas:",
            modes: [
                {
                    name: "Presiese Soektog",
                    desc: "Vind verse wat die spesifieke woorde of frases bevat wat jy tik. Ideaal om 'n direkte vers of 'n spesifieke trefwoord soos 'genade' of 'psalm 23' te vind."
                },
                {
                    name: "Konsep-soektog (AI)",
                    desc: "Vind verse gebaseer op die betekenis, tema, of gevoel van jou navraag. Uitstekend vir vrae soos 'hoe om angs te hanteer' of 'God se beloftes vir die toekoms'."
                }
            ],
            searchTipsTitle: "💡 Soek Wenke",
            searchTips: [
                "**Direkte Vers:** Tik 'Johannes 3:16' om direk na die vers te gaan ongeag die metode.",
                "**Veelvuldige Woorde:** In Presiese Soektog, gebruik kommas om verse te vind wat ENIGE van die woorde bevat. Bv: 'vader, seun'.",
                "**Frases:** Tik 'n volledige frase natuurlik, bv., 'koninkryk van God'."
            ],
            aiTitle: "🤖 AI Navorsing Laboratorium",
            aiDesc: "Gebruik die 'Vra AI' knoppie of tik hierdie kortpaaie vir diep bybelstudie:",
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
                        <p>{text.searchDesc}</p>

                        <div className="search-modes-grid" style={{ display: 'grid', gap: '15px', marginBottom: '20px' }}>
                            {text.modes.map((mode, i) => (
                                <div key={i} className="mode-card" style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '8px' }}>
                                    <h4 style={{ margin: '0 0 8px 0', color: '#818cf8' }}>{mode.name}</h4>
                                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#d1d5db' }}>{mode.desc}</p>
                                </div>
                            ))}
                        </div>

                        <h4>{text.searchTipsTitle}</h4>
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
