-- Create the Strong's Concordance Table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS strongs_concordance (
    id TEXT PRIMARY KEY, -- e.g., 'G1588'
    lemma TEXT NOT NULL, -- e.g., 'ἐκλεκτός'
    transliteration TEXT, -- e.g., 'eklektos'
    pronunciation TEXT,
    definition TEXT,
    long_definition TEXT,
    language TEXT, -- 'greek' or 'hebrew'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_strongs_lemma ON strongs_concordance(lemma);
CREATE INDEX IF NOT EXISTS idx_strongs_translit ON strongs_concordance(transliteration);

-- Enable RLS
ALTER TABLE strongs_concordance ENABLE ROW LEVEL SECURITY;

-- Create Open Read Policy (Drop first if it exists to avoid errors)
DROP POLICY IF EXISTS "Allow public read access on strongs_concordance" ON strongs_concordance;
CREATE POLICY "Allow public read access on strongs_concordance"
ON strongs_concordance FOR SELECT
USING (true);

-- Starter Data (Top used words for demonstration)
INSERT INTO strongs_concordance (id, lemma, transliteration, pronunciation, definition, language)
SELECT DISTINCT ON (id) id, lemma, transliteration, pronunciation, definition, language
FROM (
VALUES 
-- GREEK (GNT) High-Frequency
('G1588', 'ἐκλεκτός', 'eklektos', 'ek-lek-tos''', 'chosen, select, by implication favorite, ruled', 'greek'),
('G3056', 'λόγος', 'logos', 'log''-os', 'word, speech, divine utterance, reason', 'greek'),
('G26', 'ἀγάπη', 'agape', 'ag-ah''-pay', 'love, affection, benevolence, brotherly love', 'greek'),
('G4102', 'πίστις', 'pistis', 'pis''-tis', 'faith, belief, trust, confidence in God', 'greek'),
('G5485', 'χάρις', 'charis', 'khar''-ece', 'grace, favor, kindness, gift', 'greek'),
('G2316', 'θεός', 'theos', 'the-os''', 'God, a god, divine being', 'greek'),
('G2962', 'κύριος', 'kyrios', 'koo''-ree-os', 'Lord, master, owner, sir', 'greek'),
('G444', 'ἄνθρωπος', 'anthrōpos', 'anth''-ro-pos', 'man, human being, mankind', 'greek'),
('G4151', 'πνεῦμα', 'pneuma', 'pnyoo''-mah', 'spirit, wind, breath, life-force', 'greek'),
('G2222', 'ζωή', 'zōē', 'dzo-ay''', 'life, existence, vitality', 'greek'),
('G225', 'ἀλήθεια', 'alētheia', 'al-ay''-thi-ah', 'truth, reality, sincerity', 'greek'),
('G165', 'αἰών', 'aiōn', 'ahee-ohn''', 'age, eternity, world-period', 'greek'),
('G1096', 'γίνομαι', 'ginomai', 'ghin''-om-ahee', 'to become, to be, to happen, to occur', 'greek'),
('G1510', 'εἰμί', 'eimi', 'i-mee''', 'to be, to exist, to stay', 'greek'),
('G3588', 'ὁ', 'ho', 'ho', 'the, this, that (definite article)', 'greek'),
('G2532', 'καί', 'kai', 'kahee', 'and, even, also, both', 'greek'),
('G2248', 'ἡμᾶς', 'hēmas', 'hay-mas''', 'us, we (plural pronoun)', 'greek'),
('G1473', 'ἐγώ', 'egō', 'eg-o''', 'I, me (singular pronoun)', 'greek'),
('G3778', 'οὗτος', 'houtos', 'hoo''-tos', 'this, that, he, she, it', 'greek'),
('G3962', 'πατήρ', 'patēr', 'pat-ayr''', 'father, ancestor, parent', 'greek'),
('G5207', 'υἱός', 'huios', 'hwee-os''', 'son, child, descendant', 'greek'),
('G80', 'ἀδελφός', 'adelphos', 'ad-el-fos''', 'brother, fellow-believer', 'greek'),
('G2250', 'ἡμέρα', 'hēmera', 'hay-mer''-ah', 'day, time, period', 'greek'),
('G181', 'ἀνάστασις', 'anastasis', 'an-as''-tas-is', 'resurrection, rising from death', 'greek'),
('G1343', 'δικαιοσύνη', 'dikaiosynē', 'dik-ah-yos-oo''-nay', 'righteousness, justice, holiness', 'greek'),
('G1211', 'δή', 'dē', 'day', 'indeed, now, therefore, truly', 'greek'),
('G757', 'ἄρχω', 'archō', 'ar''-kho', 'to rule, govern, begin, lead', 'greek'),
('G932', 'βασιλεία', 'basileia', 'bas-il-i''-ah', 'kingdom, reign, rule, dominion', 'greek'),
('G1849', 'ἐξουσία', 'exousia', 'ex-oo-see''-ah', 'authority, power, jurisdiction, rule', 'greek'),
('G1107', 'γνωρίζω', 'gnōrizō', 'gno-rid''-zo', 'to make known, declare, reveal', 'greek'),
('G1223', 'διά', 'dia', 'dee-ah''', 'through, because of, by means of', 'greek'),
('G1411', 'δύναμις', 'dynamis', 'doo''-nam-is', 'power, miracle, strength, ability', 'greek'),
('G1391', 'δόξα', 'doxa', 'dox''-ah', 'glory, honor, splendor, brightness', 'greek'),
('G1515', 'εἰρήνη', 'eirēnē', 'i-ray''-nay', 'peace, tranquility, rest', 'greek'),
('G1577', 'ἐκκλησία', 'ekklēsia', 'ek-klay-see''-ah', 'church, assembly, congregation', 'greek'),
('G1680', 'ἐλπίς', 'elpis', 'el-pece''', 'hope, expectation, trust', 'greek'),
('G2093', 'εὐαγγέλιον', 'euaggelion', 'yoo-ang-ghel''-ee-on', 'gospel, good news', 'greek'),
('G2556', 'κακός', 'kakos', 'kak-os''', 'evil, bad, harmful, wrong', 'greek'),
('G2567', 'καλός', 'kalos', 'kal-os''', 'good, beautiful, valuable', 'greek'),
('G2744', 'καυχάομαι', 'kauchaomai', 'kow-khah''-om-ahee', 'to boast, glory, rejoice', 'greek'),
('G2889', 'κόσμος', 'kosmos', 'kos''-mos', 'world, universe, system', 'greek'),
('G3326', 'μετά', 'meta', 'met-ah''', 'with, after, behind', 'greek'),
('G3466', 'μυστήριον', 'mystērion', 'moos-tay''-ree-on', 'mystery, secret, hidden truth', 'greek'),
('G3551', 'νόμος', 'nomos', 'nom''-os', 'law, rule, commandment', 'greek'),
('G3611', 'οἰκέω', 'oikeō', 'oy-keh''-o', 'to dwell, live, inhabit', 'greek'),
('G3686', 'ὄνομα', 'onoma', 'on''-om-ah', 'name, reputation, authority', 'greek'),
('G3754', 'ὅτι', 'hoti', 'hot''-ee', 'that, because, since', 'greek'),
('G3756', 'οὐ', 'ou', 'oo', 'not, no, none', 'greek'),
('G3809', 'παιδεία', 'paideia', 'pahee-di''-ah', 'discipline, training, instruction', 'greek'),
('G3844', 'παρά', 'para', 'par-ah''', 'beside, near, from', 'greek'),
('G3956', 'πᾶς', 'pas', 'pas', 'all, every, whole, everything', 'greek'),
('G4160', 'ποιέω', 'poieō', 'poy-eh''-o', 'to do, to make, to produce', 'greek'),
('G4172', 'πόλις', 'polis', 'pol''-ece', 'city, town, state', 'greek'),
('G4190', 'πονηρός', 'ponēros', 'pon-ay-ros''', 'wicked, evil, bad, lazy', 'greek'),
('G4245', 'πρεσβύτερος', 'presbyteros', 'pres-boo''-ter-os', 'elder, older, senior', 'greek'),
('G4314', 'πρός', 'pros', 'pros', 'to, toward, with, for', 'greek'),
('G4412', 'πρῶτον', 'prōton', 'pro''-ton', 'first, foremost, chief', 'greek'),
('G4561', 'σάρξ', 'sarx', 'sarx', 'flesh, body, human nature', 'greek'),
('G4655', 'σκότος', 'skotos', 'skot''-os', 'darkness, shadow, obscurity', 'greek'),
('G4678', 'σοφία', 'sophia', 'sof-ee''-ah', 'wisdom, insight, skill', 'greek'),
('G4982', 'σώζω', 'sōzō', 'sode''-zo', 'to save, rescue, preserve', 'greek'),
('G4991', 'σωτηρία', 'sōtēria', 'so-tay-ree''-ah', 'salvation, deliverance, safety', 'greek'),
('G5023', 'ταῦτα', 'tauta', 'tow''-tah', 'these things, such things', 'greek'),
('G5046', 'τέλειος', 'teleios', 'tel''-i-os', 'perfect, complete, mature', 'greek'),
('G5101', 'τίς', 'tis', 'tis', 'who, which, what', 'greek'),
('G5287', 'ὑπόστασις', 'hypostasis', 'hoop-os''-tas-is', 'substance, confidence, reality', 'greek'),
('G5426', 'φρονέω', 'phroneō', 'fron-eh''-o', 'to think, judge, set mind on', 'greek'),
('G5481', 'χαρακτήρ', 'charaktēr', 'khar-ak-tare''', 'representation, image, character', 'greek'),
('G5547', 'Χριστός', 'Christos', 'khris-tos''', 'Christ, Anointed One, Messiah', 'greek'),
('G5565', 'χωρίς', 'chōris', 'kho-rece''', 'apart from, without, besides', 'greek'),
('G5590', 'ψυχή', 'psychē', 'psoo-khay''', 'soul, life, mind, breath', 'greek'),
('G5613', 'ὡς', 'hōs', 'hoce', 'as, like, when, about', 'greek'),

-- HEBREW (WLC) High-Frequency
('H7225', 'רֵאשִׁית', 'reshith', 'ray-sheeth''', 'beginning, chief, first-fruits', 'hebrew'),
('H430', 'אֱלֹהִים', 'elohim', 'el-o-heem''', 'God, gods, judges, angels', 'hebrew'),
('H748', 'אָרֶךְ', 'arek', 'aw-rake''', 'long, slow to anger, patient', 'hebrew'),
('H776', 'אֶרֶץ', 'eretz', 'eh''-rets', 'earth, land, ground', 'hebrew'),
('H8064', 'שָׁמַיִם', 'shamayim', 'shaw-mah''-yim', 'heavens, sky, dwelling place of God', 'hebrew'),
('H1254', 'בָּרָא', 'bara', 'baw-raw''', 'to create, shape, fashion', 'hebrew'),
('H216', 'אוֹר', 'or', 'ore', 'light, sunshine, fire, dawn', 'hebrew'),
('H3068', 'יְהֹוָה', 'Yehovah', 'yeh-ho-vaw''', 'Yahweh, Jehovah, the Lord', 'hebrew'),
('H127', 'אֲדָמָה', 'adamah', 'ad-aw-maw''', 'ground, earth, substance', 'hebrew'),
('H120', 'אָדָם', 'adam', 'aw-dawm''', 'man, humanity, Adam', 'hebrew'),
('H1285', 'בְּרִית', 'berith', 'ber-eeth''', 'covenant, treaty, alliance', 'hebrew'),
('H2617', 'חֶסֶד', 'chesed', 'kheh''-sed', 'goodness, kindness, steadfast love', 'hebrew'),
('H5315', 'נֶפֶשׁ', 'nephesh', 'neh''-fesh', 'soul, living being, life, creature', 'hebrew'),
('H7307', 'רוּחַ', 'ruach', 'roo''-akh', 'spirit, wind, breath', 'hebrew'),
('H1961', 'הָיָה', 'hayah', 'haw-yaw''', 'to be, become, come to pass, happen', 'hebrew'),
('H559', 'אָמַר', 'amar', 'aw-mar''', 'to say, speak, utter, command', 'hebrew'),
('H935', 'בּוֹא', 'bo', 'bo', 'to come, enter, go in', 'hebrew'),
('H1696', 'דָּבַר', 'dabar', 'daw-bar''', 'to speak, declare, converse', 'hebrew'),
('H1697', 'דָּבָר', 'dabar', 'daw-bawr''', 'word, thing, matter, speech', 'hebrew'),
('H3045', 'יָדַע', 'yada', 'yaw-dah''', 'to know, understand, recognize', 'hebrew'),
('H5414', 'נָתַן', 'nathan', 'naw-than''', 'to give, put, set, deliver', 'hebrew'),
('H5973', 'עִם', 'im', 'eem', 'with, beside, near', 'hebrew'),
('H5975', 'עָמַד', 'amad', 'aw-mad''', 'to stand, remain, endure', 'hebrew'),
('H6213', 'עָשָׂה', 'asah', 'aw-saw''', 'to do, make, fashion, prepare', 'hebrew'),
('H6965', 'קוּם', 'qum', 'koom', 'to arise, stand up, establish', 'hebrew'),
('H7200', 'רָאָה', 'raah', 'raw-aw''', 'to see, look, behold, perceive', 'hebrew'),
('H7725', 'שׁוּב', 'shub', 'shoob', 'to return, turn back, repent', 'hebrew'),
('H8085', 'שָׁמַע', 'shama', 'shaw-mah''', 'to hear, listen, obey', 'hebrew'),
('H4910', 'מָשַׁל', 'mashal', 'maw-shal''', 'to rule, have dominion, reign, ruled', 'hebrew'),
('H7287', 'רָדָה', 'radah', 'raw-daw''', 'to rule, subdue, have dominion', 'hebrew'),
('H4428', 'מֶלֶךְ', 'melek', 'meh''-lek', 'king, ruler, prince', 'hebrew'),
('H2416', 'חַי', 'chay', 'khah''ee', 'alive, living, life', 'hebrew'),
('H2421', 'חָיָה', 'chayah', 'khaw-yaw''', 'to live, stay alive, revive', 'hebrew')
) AS t(id, lemma, transliteration, pronunciation, definition, language)
ON CONFLICT (id) DO UPDATE SET 
    lemma = EXCLUDED.lemma,
    definition = EXCLUDED.definition;





