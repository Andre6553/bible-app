export const FOR_YOU_VERSION = 'for-you-v2';

export const FOR_YOU_FORMATS = {
    quiet_reflection: {
        en: 'Quiet reflection', af: 'Rustige nadenke', words: [220, 350],
        brief: 'Use a calm, reflective voice. Explain the supplied passage before a personal application. End with a short prayer OR a quiet observation, according to the chosen ending. Do not assume the reader is anxious or struggling.',
        endings: ['prayer', 'observation'],
    },
    passage_explainer: {
        en: 'Understand the passage', af: 'Verstaan die gedeelte', words: [180, 300],
        brief: 'Use a clear teaching voice. Explain the immediate context, one important textual detail and its implication. Finish with a concise insight. No prayer, motivational pep talk or compulsory closing question.',
        endings: ['insight', 'summary'],
    },
    bible_character: {
        en: 'People of the Bible', af: 'Mense van die Bybel', words: [180, 300],
        brief: 'Explore the named person in the supplied narrative: situation, decision and consequence. Use an observant narrative voice. Do not invent dialogue, motives or private thoughts. End with a text-supported observation, not a generic encouragement.',
        endings: ['consequence', 'observation'], narrative: true,
    },
    difficult_question: {
        en: 'A question worth exploring', af: "’n Vraag om te ondersoek", words: [200, 320],
        brief: 'Open with one genuine interpretive question raised by the passage. Examine it thoughtfully using the actual text. Distinguish what is clear from what is uncertain. Do not pretend one passage settles every related debate. End with the supported answer or its limits; no forced reassurance.',
        endings: ['answer', 'limits'],
    },
    historical_context: {
        en: 'Context that clarifies', af: 'Konteks wat verduidelik', words: [180, 290],
        brief: 'Use an informative voice to explain a detail of setting, literary form or custom supported by the supplied text/editorial note. Explain how it affects the reading. Do not invent archaeology, dates, customs or research sources. If outside background is not supplied, stick to literary and immediate context.',
        endings: ['clarification', 'insight'],
    },
    practical_discipleship: {
        en: 'Faith in practice', af: 'Geloof in die praktyk', words: [170, 280],
        brief: 'Explain the passage briefly, then propose one specific realistic practice and an everyday example. Use direct, concrete language. Label the example as an example. Do not promise a particular health, financial or relationship outcome. End with the practical step, not a compulsory prayer or question.',
        endings: ['action', 'example'],
    },
};

export const formatLabel = (id, language = 'en') => FOR_YOU_FORMATS[id]?.[language] || FOR_YOU_FORMATS[id]?.en || id;
