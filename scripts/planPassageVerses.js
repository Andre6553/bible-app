/**
 * Verse-range overrides for curated topic plans.
 *
 * Most curated plan days only store `{ book_id, chapter }`, which means the
 * Bible reader shows the entire chapter — including days where multiple plan
 * days share the same chapter (e.g. Parables of Jesus days 1–5 all = Matt 13).
 *
 * This module supplies `verse_start` / `verse_end` for each plan day so that
 * the BibleReader can auto-scroll to and highlight only the relevant passage
 * while still letting the user read the surrounding chapter for context.
 *
 * Shape:  PLAN_PASSAGE_VERSES[slug][day] = [{ book_id, chapter, verse_start, verse_end }]
 * The array matches `dayReading.passages` order (almost always one entry).
 *
 * Adding more plans is safe: missing entries fall through and the reader keeps
 * its current "whole chapter" behaviour.
 */

const PLAN_PASSAGE_VERSES = {
    'parables-20': {
        1: [{ book_id: 40, chapter: 13, verse_start: 1, verse_end: 23 }],   // The Sower
        2: [{ book_id: 40, chapter: 13, verse_start: 24, verse_end: 30 }],  // Weeds Among Wheat
        3: [{ book_id: 40, chapter: 13, verse_start: 31, verse_end: 33 }],  // Mustard Seed & Leaven
        4: [{ book_id: 40, chapter: 13, verse_start: 44, verse_end: 46 }],  // Hidden Treasure & Pearl
        5: [{ book_id: 40, chapter: 13, verse_start: 47, verse_end: 52 }],  // The Dragnet
        6: [{ book_id: 42, chapter: 10, verse_start: 25, verse_end: 37 }],  // Good Samaritan
        7: [{ book_id: 42, chapter: 15, verse_start: 1, verse_end: 7 }],    // Lost Sheep
        8: [{ book_id: 42, chapter: 15, verse_start: 8, verse_end: 10 }],   // Lost Coin
        9: [{ book_id: 42, chapter: 15, verse_start: 11, verse_end: 32 }],  // Prodigal Son
        10: [{ book_id: 42, chapter: 18, verse_start: 9, verse_end: 14 }],  // Pharisee and Tax Collector
        11: [{ book_id: 40, chapter: 18, verse_start: 21, verse_end: 35 }], // Unforgiving Servant
        12: [{ book_id: 40, chapter: 20, verse_start: 1, verse_end: 16 }],  // Workers in the Vineyard
        13: [{ book_id: 40, chapter: 21, verse_start: 28, verse_end: 32 }], // Two Sons
        14: [{ book_id: 40, chapter: 21, verse_start: 33, verse_end: 46 }], // Wicked Tenants
        15: [{ book_id: 40, chapter: 22, verse_start: 1, verse_end: 14 }],  // Wedding Banquet
        16: [{ book_id: 40, chapter: 25, verse_start: 1, verse_end: 13 }],  // Ten Virgins
        17: [{ book_id: 40, chapter: 25, verse_start: 14, verse_end: 30 }], // Talents
        18: [{ book_id: 42, chapter: 16, verse_start: 19, verse_end: 31 }], // Rich Man and Lazarus
        19: [{ book_id: 42, chapter: 18, verse_start: 1, verse_end: 8 }],   // Persistent Widow
        20: [{ book_id: 42, chapter: 18, verse_start: 9, verse_end: 14 }],  // Pharisee and Publican
    },

    'miracles-14': {
        1: [{ book_id: 43, chapter: 2, verse_start: 1, verse_end: 11 }],    // Water into Wine
        2: [{ book_id: 41, chapter: 1, verse_start: 21, verse_end: 28 }],   // Demon-possessed man
        3: [{ book_id: 41, chapter: 4, verse_start: 35, verse_end: 41 }],   // Calming the Storm
        4: [{ book_id: 41, chapter: 5, verse_start: 1, verse_end: 20 }],    // Legion
        5: [{ book_id: 41, chapter: 5, verse_start: 21, verse_end: 43 }],   // Jairus' daughter / bleeding woman
        6: [{ book_id: 40, chapter: 14, verse_start: 13, verse_end: 21 }],  // Feeding 5,000
        7: [{ book_id: 40, chapter: 14, verse_start: 22, verse_end: 33 }],  // Walking on Water
        8: [{ book_id: 43, chapter: 9, verse_start: 1, verse_end: 41 }],    // Man born blind
        9: [{ book_id: 43, chapter: 11, verse_start: 1, verse_end: 44 }],   // Lazarus raised
        10: [{ book_id: 42, chapter: 7, verse_start: 1, verse_end: 10 }],   // Centurion's servant
        11: [{ book_id: 42, chapter: 17, verse_start: 11, verse_end: 19 }], // Ten lepers
        12: [{ book_id: 40, chapter: 17, verse_start: 14, verse_end: 21 }], // Boy with a demon
        13: [{ book_id: 43, chapter: 21, verse_start: 1, verse_end: 14 }],  // Catch of fish
        14: [{ book_id: 40, chapter: 28, verse_start: 1, verse_end: 10 }],  // Resurrection
    },

    'faith-hope-21': {
        1: [{ book_id: 1, chapter: 15, verse_start: 1, verse_end: 6 }],     // Abraham's Faith — credited as righteousness
        2: [{ book_id: 19, chapter: 27, verse_start: 1, verse_end: 14 }],   // Trust in the Lord — whole psalm
        3: [{ book_id: 19, chapter: 46, verse_start: 1, verse_end: 11 }],   // God Is Our Refuge — whole psalm
        4: [{ book_id: 24, chapter: 29, verse_start: 10, verse_end: 14 }],  // Plans for Hope — Jer 29:11
        5: [{ book_id: 23, chapter: 40, verse_start: 28, verse_end: 31 }],  // Comfort My People — Isa 40:28-31 (renew strength)
        6: [{ book_id: 58, chapter: 11, verse_start: 1, verse_end: 16 }],   // By Faith — definition + Hall of Faith opening
        7: [{ book_id: 45, chapter: 4, verse_start: 1, verse_end: 12 }],    // Abraham Justified by Faith — Rom 4:1-12
        8: [{ book_id: 45, chapter: 8, verse_start: 28, verse_end: 39 }],   // No Condemnation — Rom 8:28-39
        9: [{ book_id: 60, chapter: 1, verse_start: 3, verse_end: 9 }],     // Living Hope — 1 Pe 1:3-9
        10: [{ book_id: 59, chapter: 2, verse_start: 14, verse_end: 26 }],  // Faith Without Works Is Dead — Jas 2:14-26
        11: [{ book_id: 20, chapter: 3, verse_start: 5, verse_end: 8 }],    // Trust in the Lord — Prov 3:5-8
        12: [{ book_id: 19, chapter: 37, verse_start: 1, verse_end: 11 }],  // Wait for the Lord — Ps 37:1-11
        13: [{ book_id: 23, chapter: 53, verse_start: 1, verse_end: 12 }],  // Suffering Servant — whole chapter
        14: [{ book_id: 45, chapter: 12, verse_start: 9, verse_end: 21 }],  // Rejoice in Hope — Rom 12:9-21
        15: [{ book_id: 46, chapter: 13, verse_start: 1, verse_end: 13 }],  // Faith, Hope, Love — 1 Cor 13 (whole)
        16: [{ book_id: 50, chapter: 4, verse_start: 4, verse_end: 9 }],    // Blessed Assurance — Phil 4:4-9
        17: [{ book_id: 51, chapter: 2, verse_start: 6, verse_end: 10 }],   // Rooted and Built Up — Col 2:6-10
        18: [{ book_id: 52, chapter: 4, verse_start: 13, verse_end: 18 }],  // Encourage One Another — 1 Thess 4:13-18
        19: [{ book_id: 55, chapter: 4, verse_start: 6, verse_end: 8 }],    // Fight the Good Fight — 2 Tim 4:6-8
        20: [{ book_id: 58, chapter: 6, verse_start: 13, verse_end: 20 }],  // Hold Fast to Hope — Heb 6:13-20 (anchor for the soul)
        21: [{ book_id: 66, chapter: 21, verse_start: 1, verse_end: 8 }],   // New Heaven and Earth — Rev 21:1-8
    },

    'women-bible-30': {
        1: [{ book_id: 1, chapter: 2, verse_start: 18, verse_end: 25 }],    // Eve — formed from Adam
        2: [{ book_id: 1, chapter: 21, verse_start: 1, verse_end: 7 }],     // Sarah — Isaac born
        3: [{ book_id: 1, chapter: 24, verse_start: 10, verse_end: 28 }],   // Rebekah — at the well
        4: [{ book_id: 1, chapter: 29, verse_start: 15, verse_end: 30 }],   // Rachel and Leah married
        5: [{ book_id: 2, chapter: 15, verse_start: 19, verse_end: 21 }],   // Miriam's song
        6: [{ book_id: 6, chapter: 2, verse_start: 1, verse_end: 21 }],     // Rahab hides the spies
        7: [{ book_id: 7, chapter: 4, verse_start: 1, verse_end: 16 }],     // Deborah leads Israel
        8: [{ book_id: 8, chapter: 1, verse_start: 6, verse_end: 18 }],     // Ruth's "your people will be my people"
        9: [{ book_id: 9, chapter: 1, verse_start: 9, verse_end: 28 }],     // Hannah's prayer answered
        10: [{ book_id: 9, chapter: 25, verse_start: 14, verse_end: 35 }],  // Abigail intercedes with David
        11: [{ book_id: 17, chapter: 4, verse_start: 12, verse_end: 17 }],  // Esther — "for such a time"
        12: [{ book_id: 20, chapter: 31, verse_start: 10, verse_end: 31 }], // Virtuous Woman
        13: [{ book_id: 42, chapter: 1, verse_start: 5, verse_end: 25 }],   // Elizabeth — Zechariah & promise
        14: [{ book_id: 42, chapter: 1, verse_start: 26, verse_end: 38 }],  // Mary — annunciation
        15: [{ book_id: 42, chapter: 2, verse_start: 36, verse_end: 38 }],  // Anna the prophetess
        16: [{ book_id: 43, chapter: 4, verse_start: 1, verse_end: 30 }],   // Woman at the well
        17: [{ book_id: 43, chapter: 8, verse_start: 1, verse_end: 11 }],   // Woman caught in adultery
        18: [{ book_id: 43, chapter: 11, verse_start: 17, verse_end: 44 }], // Mary and Martha at Lazarus' tomb
        19: [{ book_id: 41, chapter: 12, verse_start: 41, verse_end: 44 }], // Widow's offering
        20: [{ book_id: 44, chapter: 9, verse_start: 36, verse_end: 42 }],  // Dorcas raised
        21: [{ book_id: 44, chapter: 16, verse_start: 11, verse_end: 15 }], // Lydia — first European convert
        22: [{ book_id: 44, chapter: 18, verse_start: 18, verse_end: 26 }], // Priscilla and Aquila teach Apollos
        23: [{ book_id: 45, chapter: 16, verse_start: 1, verse_end: 2 }],   // Phoebe commended
        24: [{ book_id: 55, chapter: 1, verse_start: 3, verse_end: 7 }],    // Lois and Eunice's faith
        25: [{ book_id: 8, chapter: 4, verse_start: 13, verse_end: 22 }],   // Ruth — Obed born, line of David
        26: [{ book_id: 17, chapter: 7, verse_start: 1, verse_end: 10 }],   // Esther saves her people
        27: [{ book_id: 42, chapter: 1, verse_start: 46, verse_end: 55 }],  // Magnificat
        28: [{ book_id: 43, chapter: 19, verse_start: 25, verse_end: 27 }], // Mary at the cross
        29: [{ book_id: 42, chapter: 24, verse_start: 1, verse_end: 12 }],  // Women at the tomb
        30: [{ book_id: 20, chapter: 31, verse_start: 10, verse_end: 31 }], // Proverbs 31 Woman
    },

    'beginner-14': {
        1: [{ book_id: 1, chapter: 1, verse_start: 1, verse_end: 5 }],      // In the Beginning — vv 1-5 ("Let there be light")
        2: [{ book_id: 43, chapter: 1, verse_start: 1, verse_end: 14 }],    // The Word Became Flesh — John 1:1-14
        3: [{ book_id: 43, chapter: 3, verse_start: 14, verse_end: 21 }],   // John 3:16 surroundings
        4: [{ book_id: 19, chapter: 23, verse_start: 1, verse_end: 6 }],    // Psalm 23 whole
        5: [{ book_id: 45, chapter: 8, verse_start: 28, verse_end: 39 }],   // Rom 8:28-39
        6: [{ book_id: 40, chapter: 5, verse_start: 1, verse_end: 12 }],    // Beatitudes
        7: [{ book_id: 42, chapter: 2, verse_start: 1, verse_end: 20 }],    // Birth of Jesus — Luke 2:1-20
        8: [{ book_id: 2, chapter: 20, verse_start: 1, verse_end: 17 }],    // Ten Commandments
        9: [{ book_id: 50, chapter: 4, verse_start: 4, verse_end: 9 }],     // Rejoice in the Lord — Phil 4:4-9
        10: [{ book_id: 20, chapter: 3, verse_start: 5, verse_end: 8 }],    // Trust in the Lord — Prov 3:5-8
        11: [{ book_id: 23, chapter: 53, verse_start: 1, verse_end: 12 }],  // Suffering Servant — whole
        12: [{ book_id: 44, chapter: 2, verse_start: 1, verse_end: 21 }],   // Day of Pentecost
        13: [{ book_id: 66, chapter: 21, verse_start: 1, verse_end: 8 }],   // New Heaven and Earth
        14: [{ book_id: 1, chapter: 12, verse_start: 1, verse_end: 9 }],    // Call of Abraham
    },

    'family-52': {
        1: [{ book_id: 1, chapter: 1, verse_start: 1, verse_end: 5 }],      // Creation — light
        2: [{ book_id: 1, chapter: 2, verse_start: 7, verse_end: 25 }],     // Adam and Eve
        3: [{ book_id: 1, chapter: 7, verse_start: 1, verse_end: 24 }],     // Flood / Noah enters ark
        4: [{ book_id: 1, chapter: 9, verse_start: 8, verse_end: 17 }],     // Covenant with Noah — rainbow
        5: [{ book_id: 1, chapter: 12, verse_start: 1, verse_end: 9 }],     // Abraham's call
        6: [{ book_id: 1, chapter: 21, verse_start: 1, verse_end: 7 }],     // Isaac born
        7: [{ book_id: 1, chapter: 28, verse_start: 10, verse_end: 22 }],   // Jacob's ladder
        8: [{ book_id: 1, chapter: 37, verse_start: 1, verse_end: 28 }],    // Joseph's dreams
        9: [{ book_id: 1, chapter: 41, verse_start: 14, verse_end: 44 }],   // Joseph in Egypt — exalted
        10: [{ book_id: 2, chapter: 3, verse_start: 1, verse_end: 15 }],    // Moses & burning bush
        11: [{ book_id: 2, chapter: 14, verse_start: 13, verse_end: 31 }],  // Red Sea crossing
        12: [{ book_id: 2, chapter: 20, verse_start: 1, verse_end: 17 }],   // Ten Commandments
        13: [{ book_id: 6, chapter: 6, verse_start: 1, verse_end: 27 }],    // Joshua / Jericho
        14: [{ book_id: 9, chapter: 17, verse_start: 32, verse_end: 51 }],  // David and Goliath
        15: [{ book_id: 27, chapter: 6, verse_start: 10, verse_end: 28 }],  // Daniel in lions' den
        16: [{ book_id: 32, chapter: 1, verse_start: 1, verse_end: 17 }],   // Jonah and the fish
        17: [{ book_id: 42, chapter: 2, verse_start: 1, verse_end: 20 }],   // Birth of Jesus
        18: [{ book_id: 42, chapter: 2, verse_start: 41, verse_end: 52 }],  // Boy Jesus in the temple
        19: [{ book_id: 40, chapter: 3, verse_start: 13, verse_end: 17 }],  // Jesus baptized
        20: [{ book_id: 42, chapter: 10, verse_start: 25, verse_end: 37 }], // Good Samaritan
        21: [{ book_id: 43, chapter: 6, verse_start: 1, verse_end: 15 }],   // Feeding the 5,000 (John account)
        22: [{ book_id: 41, chapter: 4, verse_start: 35, verse_end: 41 }],  // Calming the storm
        23: [{ book_id: 42, chapter: 19, verse_start: 1, verse_end: 10 }],  // Zacchaeus
        24: [{ book_id: 42, chapter: 22, verse_start: 14, verse_end: 23 }], // Last Supper
        25: [{ book_id: 42, chapter: 23, verse_start: 32, verse_end: 49 }], // Jesus crucified
        26: [{ book_id: 42, chapter: 24, verse_start: 1, verse_end: 12 }],  // Resurrection (Luke account)
        27: [{ book_id: 19, chapter: 23, verse_start: 1, verse_end: 6 }],   // Psalm 23
        28: [{ book_id: 43, chapter: 13, verse_start: 34, verse_end: 35 }], // Love one another
        29: [{ book_id: 48, chapter: 5, verse_start: 22, verse_end: 26 }],  // Fruit of the Spirit
        30: [{ book_id: 49, chapter: 6, verse_start: 10, verse_end: 18 }],  // Armor of God
        31: [{ book_id: 8, chapter: 1, verse_start: 16, verse_end: 22 }],   // Ruth — "your people my people"
        32: [{ book_id: 17, chapter: 4, verse_start: 12, verse_end: 17 }],  // Esther — for such a time
        33: [{ book_id: 27, chapter: 3, verse_start: 13, verse_end: 30 }],  // Fiery furnace
        34: [{ book_id: 42, chapter: 15, verse_start: 11, verse_end: 32 }], // Prodigal Son
        35: [{ book_id: 40, chapter: 19, verse_start: 13, verse_end: 15 }], // Let the children come
        36: [{ book_id: 40, chapter: 7, verse_start: 7, verse_end: 12 }],   // Golden Rule
        37: [{ book_id: 40, chapter: 6, verse_start: 25, verse_end: 34 }],  // Do not worry
        38: [{ book_id: 40, chapter: 28, verse_start: 16, verse_end: 20 }], // Great Commission
        39: [{ book_id: 43, chapter: 3, verse_start: 14, verse_end: 21 }],  // God loves you — John 3:16ff
        40: [{ book_id: 40, chapter: 17, verse_start: 14, verse_end: 21 }], // Faith like mustard seed
        41: [{ book_id: 42, chapter: 15, verse_start: 1, verse_end: 7 }],   // Lost Sheep
        42: [{ book_id: 2, chapter: 20, verse_start: 8, verse_end: 11 }],   // Sabbath command
        43: [{ book_id: 11, chapter: 3, verse_start: 5, verse_end: 15 }],   // Solomon's wisdom
        44: [{ book_id: 11, chapter: 18, verse_start: 20, verse_end: 39 }], // Elijah and Baal prophets
        45: [{ book_id: 16, chapter: 2, verse_start: 1, verse_end: 20 }],   // Nehemiah & the king
        46: [{ book_id: 43, chapter: 9, verse_start: 1, verse_end: 41 }],   // Healing the blind man
        47: [{ book_id: 44, chapter: 2, verse_start: 1, verse_end: 21 }],   // Pentecost
        48: [{ book_id: 44, chapter: 9, verse_start: 1, verse_end: 22 }],   // Paul's conversion
        49: [{ book_id: 66, chapter: 21, verse_start: 1, verse_end: 8 }],   // Heaven — no more tears
        50: [{ book_id: 20, chapter: 3, verse_start: 5, verse_end: 8 }],    // Trust in the Lord
        51: [{ book_id: 52, chapter: 5, verse_start: 16, verse_end: 18 }],  // Give thanks always
        52: [{ book_id: 62, chapter: 4, verse_start: 7, verse_end: 21 }],   // God is love
    },
};

/**
 * Look up the verse range for a given plan slug + day.
 * Returns the array of passages with verse_start/verse_end (or null if no override).
 */
export function getPlanDayVerseRanges(slug, day) {
    if (!slug || !day) return null;
    const planMap = PLAN_PASSAGE_VERSES[slug];
    if (!planMap) return null;
    return planMap[Number(day)] || null;
}

/**
 * Walk a plan's readings array and attach verse_start/verse_end to passages.
 * Mutates a shallow copy — does not touch the original objects.
 *
 * @param {string} slug
 * @param {Array} readings
 * @returns {Array}
 */
export function applyPlanPassageVerses(slug, readings) {
    if (!Array.isArray(readings) || !PLAN_PASSAGE_VERSES[slug]) return readings;

    return readings.map((day) => {
        const overrides = getPlanDayVerseRanges(slug, day.day);
        if (!overrides || !day.passages?.length) return day;

        const passages = day.passages.map((p, idx) => {
            const override = overrides[idx];
            if (!override) return p;
            if (
                Number(override.book_id) !== Number(p.book_id) ||
                Number(override.chapter) !== Number(p.chapter)
            ) {
                return p;
            }
            return {
                ...p,
                verse_start: override.verse_start,
                verse_end: override.verse_end,
            };
        });

        return { ...day, passages };
    });
}
