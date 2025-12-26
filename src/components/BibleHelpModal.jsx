import React from 'react';
import './BibleReader.css'; // Re-use bible reader styling

const BibleHelpModal = ({ onClose, language }) => {

    const content = {
        en: {
            title: "How to use this App",
            sections: [
                {
                    title: "📖 Reading the Bible",
                    text: "Tap the **Book Name** button to browse books, chapters, and verses. Use the **< / >** arrows to navigate between chapters."
                },
                {
                    title: "📚 Word Study (Original Languages)",
                    text: "Tap any verse number, select **'Word Study'**, then tap any Greek or Hebrew word to find its deep meaning, grammar, and usage."
                },
                {
                    title: "🔍 Search",
                    text: "Go to the **Search** tab to find verses by keyword. Supports **multi-word search** (e.g., 'grace, mercy') to find verses with ANY of the words. You can filter by Bible version and Testament (Old/New)."
                },
                {
                    title: "🤖 AI Research",
                    text: "Ask any Bible question! Click **'AI Research'** in Search to get AI-powered answers with scripture references. Click the references to jump directly to those verses."
                },
                {
                    title: "⚡ AI Shortcuts",
                    text: "Use quick commands in AI Research for faster questions:",
                    shortcuts: [
                        { cmd: "/story", desc: "Tell me the story of..." },
                        { cmd: "/explain", desc: "Explain..." },
                        { cmd: "/meaning", desc: "What is the biblical meaning of..." },
                        { cmd: "/who", desc: "Who was..." },
                        { cmd: "/what", desc: "What was..." },
                        { cmd: "/why", desc: "Why did..." },
                        { cmd: "/teach", desc: "What does the Bible teach..." },
                        { cmd: "/compare", desc: "Compare in the Bible..." },
                        { cmd: "/help", desc: "Show all shortcuts" }
                    ]
                },
                {
                    title: "✨ For You (Blog)",
                    text: "Discover personalized content! Get a **daily devotional** based on your interests, browse **trending topics**, and read **recommended articles** tailored to your search history."
                },
                {
                    title: "📝 Quick Search",
                    text: "**Select any word** in the Bible text, then choose to search for it in the Old or New Testament."
                },
                {
                    title: "🖍️ Highlights & Categories",
                    text: "Swipe or tap a verse to highlight it. **Right-click (PC)** or **Long-press (Mobile)** a color circle to rename it. You can see all your highlights grouped by category in your **Profile**."
                },
                {
                    title: "🏷️ Multi-Topic Tagging",
                    text: "You can tag a verse under multiple topics! Use a **comma** when naming a color (e.g., 'Faith, Promises'). The verse will appear under both categories in your Profile."
                },
                {
                    title: "🧹 Bulk Actions",
                    text: "In **Search**, use the 'Select' button to pick multiple verses at once. You can highlight or remove highlights for all selected verses in one tap."
                },
                {
                    title: "🌍 Bible Versions",
                    text: "Switch between **KJV** (English), **AFR53** (Afrikaans), **AFR83**, **NLT**, and **AMP** using the dropdown at the top."
                }
            ],
            close: "Close"
        },
        af: {
            title: "Hoe om hierdie App te gebruik",
            sections: [
                {
                    title: "📖 Die Bybel Lees",
                    text: "Tik op die **Boeknaam** knoppie om deur boeke, hoofstukke en verse te blaai. Gebruik die **< / >** pyle om tussen hoofstukke te navigeer."
                },
                {
                    title: "📚 Woordstudie (Oorspronklike Tale)",
                    text: "Tik op enige versnommer, kies **'Woordstudie'**, en tik dan op enige Griekse of Hebreeuse woord om sy diepgaande betekenis, grammatika en gebruik te vind."
                },
                {
                    title: "🔍 Soek",
                    text: "Gaan na die **Soek** (Search) oortjie om verse per sleutelwoord te vind. Ondersteun **veelvuldige woordsoektog** (bv. 'genade, barmhartigheid'). Jy kan filter volgens Bybelweergawe en Testament (Ou/Nuut)."
                },
                {
                    title: "🤖 AI Navorsing",
                    text: "Vra enige Bybelvraag! Klik **'AI Research'** in Soek om AI-gegenereerde antwoorde met skrifverwysings te kry. Klik op die verwysings om direk na daardie verse te gaan."
                },
                {
                    title: "⚡ AI Kortpaaie",
                    text: "Gebruik vinnige opdragte in AI Navorsing vir vinniger vrae:",
                    shortcuts: [
                        { cmd: "/story", desc: "Vertel my die storie van..." },
                        { cmd: "/explain", desc: "Verduidelik..." },
                        { cmd: "/meaning", desc: "Wat is die bybelse betekenis van..." },
                        { cmd: "/who", desc: "Who was..." },
                        { cmd: "/what", desc: "What was..." },
                        { cmd: "/why", desc: "Hoekom het..." },
                        { cmd: "/teach", desc: "Wat leer die Bybel oor..." },
                        { cmd: "/compare", desc: "Vergelyk in die Bybel..." },
                        { cmd: "/help", desc: "Wys alle kortpaaie" }
                    ]
                },
                {
                    title: "✨ Vir Jou (Blog)",
                    text: "Ontdek gepersonaliseerde inhoud! Kry 'n **daaglikse oordenking** gebaseer op jou belangstellings, blaai deur **gewilde onderwerpe**, en lees **aanbevole artikels** wat aangepas is vir jou soekgeskiedenis."
                },
                {
                    title: "📝 Vinnige Soektog",
                    text: "**Kies enige woord** in die Bybelteks, en kies dan om daarvoor te soek in die Ou of Nuwe Testament."
                },
                {
                    title: "🖍️ Verligting & Kategorieë",
                    text: "Tik op 'n vers om dit te verlig. **Regsklik (PC)** of **Lang-druk (Mobiel)** op 'n kleur sirkel om dit te hernoem. Jy kan al jou verligte verse gegroepeer volgens kategorie in jou **Profiel** sien."
                },
                {
                    title: "🏷️ Veelvuldige Onderwerpe",
                    text: "Jy kan 'n vers onder verskeie onderwerpe merk! Gebruik 'n **komma** wanneer jy 'n kleur benoem (bv. 'Geloof, Beloftes'). Die vers sal onder beide kategorieë in jou Profiel verskyn."
                },
                {
                    title: "🧹 Massa-aksies",
                    text: "In **Soek**, gebruik die 'Select' knoppie om veelvuldige verse gelyktydig te kies. Jy kan verligting byvoeg of verwyder vir alle geselekteerde verse met een tik."
                },
                {
                    title: "🌍 Bybel Weergawes",
                    text: "Wissel tussen **KJV** (Engels), **AFR53** (Afrikaans), **AFR83**, **NLT**, en **AMP** met die aftreklys bo-aan."
                }
            ],
            close: "Maak Toe"
        }
    };

    const text = content[language] || content.en;

    const renderText = (str) => {
        const parts = str.split(/(\*\*.*?\*\*)/g);
        return parts.map((part, index) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={index}>{part.slice(2, -2)}</strong>;
            }
            return part;
        });
    };

    return (
        <div className="book-selector-modal" onClick={onClose}>
            <div className="book-selector-content info-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{text.title}</h2>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>

                <div className="modal-body info-body">
                    {text.sections.map((section, index) => (
                        <div key={index} className="info-section">
                            <h3>{section.title}</h3>
                            <p>{renderText(section.text)}</p>

                            {section.shortcuts && (
                                <p style={{ fontSize: '0.85rem', lineHeight: '1.6', marginTop: '10px' }}>
                                    {section.shortcuts.map((s, i) => (
                                        <React.Fragment key={i}>
                                            <strong>{s.cmd}</strong> - {s.desc}<br />
                                        </React.Fragment>
                                    ))}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default BibleHelpModal;
