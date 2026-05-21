/**
 * Generates study commentary and reflection questions for reading plan days.
 */

import { buildCommentarySection } from './chapterSummaries.js';

const DEFAULT_QUESTIONS = {
    en: [
        'What does this passage reveal about God?',
        'What promise, command, or truth stands out to you?',
        'How can you apply this to your life today?',
    ],
    af: [
        'Wat openbaar hierdie gedeelte oor God?',
        'Watter belofte, gebod of waarheid val vir jou op?',
        'Hoe kan jy dit vandag in jou lewe toepas?',
    ],
};

const PLAN_DAY_INTROS = {
    'proverbs-31': {
        en: 'Today you read one chapter of Proverbs. Study each section below, then look for one practical principle to live out.',
        af: 'Vandag lees jy een hoofstuk van Spreuke. Bestudeer elke afdeling hieronder, soek dan een praktiese beginsel om uit te leef.',
    },
    'psalms-30': {
        en: 'These psalms cover a range of human experience before God. Use the chapter summaries as a guide for prayer and reflection.',
        af: 'Hierdie psalms dek \'n reeks menslike ervaring voor God. Gebruik die hoofstuk-opsommings as gids vir gebed en refleksie.',
    },
    'bible-365': {
        en: 'You are reading through the whole Bible. Each chapter summary below helps you grasp the main story before you read the verses.',
        af: 'Jy lees deur die hele Bybel. Elke hoofstuk-opsomming hieronder help jou die hoofverhaal te begryp voordat jy die verse lees.',
    },
    'gospels-40': {
        en: 'These Gospel chapters reveal Jesus. Read each summary, then watch for what Jesus teaches, does, and calls you to.',
        af: 'Hierdie Evangelie-hoofstukke openbaar Jesus. Lees elke opsomming, let dan op wat Jesus leer, doen en jou roep.',
    },
    'nt-90': {
        en: 'New Testament reading for today. Each section summarizes a chapter so you can follow the flow of the text.',
        af: 'Nuwe Testament leeswerk vir vandag. Elke afdeling som \'n hoofstuk op sodat jy die vloei van die teks kan volg.',
    },
    'ot-180': {
        en: 'Old Testament narrative and teaching. Use the chapter summaries to track God\'s covenant story across history.',
        af: 'Ou Testament verhaal en lering. Gebruik die hoofstuk-opsommings om God se verbondverhaal deur die geskiedenis te volg.',
    },
    'paul-30': {
        en: 'Paul\'s letters teach doctrine and life. Each chapter summary highlights key themes before you read.',
        af: 'Paulus se briewe leer leerstelling en lewe. Elke hoofstuk-opsomming beklemtoon sleutel temas voordat jy lees.',
    },
    'family-52': {
        en: 'Family devotion reading. Read each summary together, then discuss what you learn about God.',
        af: 'Gesins toewyding leeswerk. Lees elke opsomming saam, bespreek dan wat julle oor God leer.',
    },
    'beginner-14': {
        en: 'Foundational Bible reading. Each chapter summary explains why this passage matters in the bigger story.',
        af: 'Grondleggende Bybel leeswerk. Elke hoofstuk-opsomming verduidelik hoekom hierdie gedeelte saak maak in die groter storie.',
    },
};

function getDayIntro(planSlug, day) {
    if (PLAN_DAY_INTROS[planSlug]) return PLAN_DAY_INTROS[planSlug];

    if (day.title_en && !day.title_en.match(/^\d/)) {
        return {
            en: `Today's themed reading: ${day.title_en}. Study each chapter section below as you read.`,
            af: `Vandag se tematiese leeswerk: ${day.title_af || day.title_en}. Bestudeer elke hoofstuk-afdeling hieronder terwyl jy lees.`,
        };
    }

    return {
        en: 'Read each chapter below, using the summaries to guide your study before and after you read the verses.',
        af: 'Lees elke hoofstuk hieronder en gebruik die opsommings om jou studie te begelei voor en nadat jy die verse lees.',
    };
}

function buildFlatCommentary(intro, sections, lang) {
    const introText = lang === 'af' ? intro.af : intro.en;
    const parts = [introText];

    for (const section of sections) {
        const heading = lang === 'af' ? section.heading_af : section.heading_en;
        const summary = lang === 'af' ? section.summary_af : section.summary_en;
        const points = lang === 'af' ? section.study_points_af : section.study_points_en;
        let block = `${heading}\n${summary}`;
        if (points?.length) {
            for (const point of points) {
                const verseTag = point.verses ? ` [${point.verses}]` : '';
                block += `\n\n${point.title}${verseTag}\n${point.detail}`;
            }
        }
        const teaching = lang === 'af' ? section.teaching_af : section.teaching_en;
        const teachingWhy = lang === 'af' ? section.teaching_why_af : section.teaching_why_en;
        if (teaching) {
            block += `\n\nWhat God wants us to know:\n${teaching}`;
            if (teachingWhy) block += `\n\nWhy:\n${teachingWhy}`;
        }
        const crossRefs = lang === 'af' ? section.cross_references_af : section.cross_references_en;
        if (crossRefs?.length) {
            block += `\n\nSimilar elsewhere:`;
            for (const cr of crossRefs) {
                block += `\n${cr.ref}: ${cr.comparison}`;
            }
        }
        parts.push(block);
    }

    return parts.filter(Boolean).join('\n\n');
}

export function enrichDayReading(day, planSlug) {
    if (!day.passages?.length) return day;

    const intro = getDayIntro(planSlug, day);
    const commentarySections = day.passages.map((p) =>
        buildCommentarySection(p.book_id, p.chapter)
    );

    return {
        ...day,
        commentary_intro_en: intro.en,
        commentary_intro_af: intro.af,
        commentary_sections: commentarySections,
        commentary_en: buildFlatCommentary(intro, commentarySections, 'en'),
        commentary_af: buildFlatCommentary(intro, commentarySections, 'af'),
        questions_en: [...DEFAULT_QUESTIONS.en],
        questions_af: [...DEFAULT_QUESTIONS.af],
    };
}

export function enrichSchedule(readings, planSlug) {
    return readings.map((day) => enrichDayReading(day, planSlug));
}

export const PLAN_STUDY_GUIDES = {
    'proverbs-31': {
        en: 'This plan walks through Proverbs one chapter per day. Each day includes per-chapter summaries, key points, and reflection questions.',
        af: 'Hierdie plan loop deur Spreuke een hoofstuk per dag. Elke dag sluit hoofstuk-opsommings, sleutel punte en refleksie vrae in.',
    },
    'psalms-30': {
        en: 'Journey through all 150 Psalms in 30 days. Each reading day breaks down the chapters with summaries and study questions.',
        af: 'Reis deur al 150 Psalms in 30 dae. Elke leesdag breek die hoofstukke af met opsommings en studie vrae.',
    },
    'gospels-40': {
        en: 'Read all four Gospels in 40 days. Every day includes chapter-by-chapter commentary explaining Jesus\' life and teaching.',
        af: 'Lees al vier Evangelies in 40 dae. Elke dag sluit hoofstuk-vir-hoofstuk kommentaar in wat Jesus se lewe en lering verduidelik.',
    },
    'nt-90': {
        en: 'Complete the New Testament in 90 days with a summary for each chapter you read.',
        af: 'Voltooi die Nuwe Testament in 90 dae met \'n opsomming vir elke hoofstuk wat jy lees.',
    },
    'bible-365': {
        en: 'Read the entire Bible in one year. Each day lists every chapter with its own summary, highlights, and study questions.',
        af: 'Lees die hele Bybel in een jaar. Elke dag lys elke hoofstuk met sy eie opsomming, sleutel punte en studie vrae.',
    },
    'ot-180': {
        en: 'Journey through the Old Testament in six months. Daily commentary breaks down each chapter with context and key themes.',
        af: 'Reis deur die Ou Testament in ses maande. Daaglikse kommentaar breek elke hoofstuk af met konteks en sleutel temas.',
    },
    'paul-30': {
        en: 'Study Paul\'s epistles in 30 days with chapter summaries connecting doctrine to daily life.',
        af: 'Bestudeer Paulus se briewe in 30 dae met hoofstuk-opsommings wat leerstelling met daaglikse lewe verbind.',
    },
    'revelation-22': {
        en: 'One chapter of Revelation per day with a detailed summary of symbols, themes, and hope.',
        af: 'Een hoofstuk van Openbaring per dag met \'n gedetailleerde opsomming van simbole, temas en hoop.',
    },
    'romans-16': {
        en: 'Deep dive through Romans with a summary and key points for every chapter.',
        af: 'Diep duik deur Romeine met \'n opsomming en sleutel punte vir elke hoofstuk.',
    },
    'john-21': {
        en: 'Walk through John\'s Gospel with a chapter summary each day on who Jesus is.',
        af: 'Loop deur Johannes se Evangelie met \'n hoofstuk-opsomming elke dag oor wie Jesus is.',
    },
    'parables-20': {
        en: 'Explore 20 parables with per-passage commentary explaining meaning and application.',
        af: 'Verken 20 gelykenisse met kommentaar per gedeelte wat betekenis en toepassing verduidelik.',
    },
    'miracles-14': {
        en: '14 days of Jesus\' miracles with study notes on what each sign reveals.',
        af: '14 dae van Jesus se wonderwerke met studienotas oor wat elke teken openbaar.',
    },
    'faith-hope-21': {
        en: '21 themed passages with commentary sections for each chapter you read.',
        af: '21 tematiese gedeeltes met kommentaar-afdelings vir elke hoofstuk wat jy lees.',
    },
    'women-bible-30': {
        en: '30 stories of women in Scripture with chapter summaries and reflection questions.',
        af: '30 stories van vroue in die Skrif met hoofstuk-opsommings en refleksie vrae.',
    },
    'beginner-14': {
        en: 'A guided introduction with a summary for each essential chapter and why it matters.',
        af: '\'n Begeleide inleiding met \'n opsomming vir elke essensiële hoofstuk en hoekom dit saak maak.',
    },
    'family-52': {
        en: '52 weekly family devotions with chapter summaries and discussion prompts.',
        af: '52 weeklikse gesins toewyding met hoofstuk-opsommings en besprekings aanwysings.',
    },
};
