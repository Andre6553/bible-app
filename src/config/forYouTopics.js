import { CANONICAL_BOOKS } from '../constants/canonicalBooks';

// Canonical coordinates, never assumed database book IDs. Quotations come from verses.
const p = (book, chapter, start, end, person = null) => ({ book, chapter, start, end, person });
const topic = (id, en, af, aliases, passages) => ({ id, en, af, aliases: [id, en, af, ...aliases], passages });

export const FOR_YOU_TOPICS = [
    topic('faith', 'Faith', 'Geloof', ['believe', 'trust', 'glo', 'vertrou'], [p(58, 11, 1, 6), p(40, 14, 22, 33, 'Peter')]),
    topic('hope', 'Hope', 'Hoop', ['hopeful'], [p(45, 5, 1, 5), p(25, 3, 19, 26)]),
    topic('love', 'Love', 'Liefde', ['loving', 'loved', 'lief'], [p(46, 13, 1, 7), p(42, 10, 25, 37, 'the Samaritan in Jesus’ parable')]),
    topic('prayer', 'Prayer', 'Gebed', ['pray', 'praying', 'bid'], [p(40, 6, 5, 13), p(9, 1, 9, 18, 'Hannah')]),
    topic('forgiveness', 'Forgiveness', 'Vergifnis', ['forgive', 'forgiving', 'vergewe', 'forgiving yourself'], [p(40, 18, 21, 35, 'the servant in Jesus’ parable'), p(1, 50, 15, 21, 'Joseph')]),
    topic('peace', 'Peace', 'Vrede', ['calm', 'worry', 'rustigheid', 'bekommernis'], [p(50, 4, 4, 9), p(43, 14, 25, 27)]),
    topic('grace', 'Grace', 'Genade', ['mercy', 'barmhartigheid'], [p(49, 2, 1, 10), p(42, 15, 11, 24, 'the father and son in Jesus’ parable')]),
    topic('salvation', 'Salvation', 'Verlossing', ['saved', 'eternal life', 'redding', 'saligheid'], [p(43, 3, 14, 21), p(44, 16, 25, 34, 'the jailer')]),
    topic('healing', 'Healing', 'Genesing', ['heal', 'health', 'genees'], [p(41, 2, 1, 12, 'the paralysed man'), p(59, 5, 13, 16)]),
    topic('wisdom', 'Wisdom', 'Wysheid', ['wise', 'understanding', 'verstand'], [p(59, 1, 2, 8), p(20, 3, 1, 8)]),
    topic('strength', 'Courage', 'Moed', ['strength', 'strong', 'krag', 'sterkte'], [p(6, 1, 1, 9, 'Joshua'), p(47, 12, 7, 10)]),
    topic('joy', 'Joy', 'Vreugde', ['happy', 'happiness', 'blydskap'], [p(50, 4, 4, 9), p(43, 15, 9, 17)]),
    topic('family', 'Family', 'Gesin', ['marriage', 'children', 'parents', 'familie', 'huwelik'], [p(5, 6, 4, 9), p(8, 1, 14, 18, 'Ruth and Naomi')]),
    topic('fear', 'Fear and anxiety', 'Vrees en angs', ['fear', 'afraid', 'anxiety', 'vrees', 'bang', 'angs'], [p(19, 56, 1, 4), p(41, 4, 35, 41, 'the disciples')]),
    topic('purpose', 'Purpose', 'Doel', ['calling', 'roeping'], [p(49, 2, 8, 10), p(2, 3, 1, 12, 'Moses')]),
    topic('patience', 'Patience', 'Geduld', ['patient', 'waiting', 'wag'], [p(59, 5, 7, 11), p(19, 27, 7, 14)]),
    topic('holy_spirit', 'Holy Spirit', 'Heilige Gees', ['spirit of god'], [p(43, 14, 15, 26), p(48, 5, 16, 25)]),
    topic('grief', 'Grief', 'Rou', ['loss', 'mourning', 'hartseer', 'verlies'], [p(43, 11, 28, 37, 'Martha, Mary and Jesus'), p(19, 13, 1, 6)]),
    topic('discipleship', 'Following Jesus', 'Volg Jesus', ['disciple', 'discipleship', 'dissipel', 'navolging'], [p(41, 8, 27, 38, 'Peter'), p(42, 9, 57, 62)]),
    ...CANONICAL_BOOKS.map(b => topic(`book_${b.id}`, b.name, b.name_af, [], [p(b.id, 1, 1, 5)])),
];

export const TOPIC_BY_ID = Object.fromEntries(FOR_YOU_TOPICS.map(t => [t.id, t]));
export const DEFAULT_TOPIC_IDS = ['faith', 'hope', 'love', 'prayer', 'wisdom', 'grace'];
export const topicLabel = (id, language = 'en') => TOPIC_BY_ID[id]?.[language] || TOPIC_BY_ID[id]?.en || id;
