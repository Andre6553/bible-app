import puppeteer from 'puppeteer';
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

// Init Supabase (Service Role for Deletion)
const supabase = createClient(
    'https://fikjnvkzhemamtlwsrin.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const genAI = new GoogleGenerativeAI(process.env.VITE_GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });


async function verifyWithAI(question, answer, verseText, ref) {
    const prompt = `
    STRICT DATA INTEGRITY CHECK.
    
    1. Question: "${question}"
    2. Proposed Correct Answer: "${answer}"
    3. Scripture Text: "${verseText}"

    VERIFICATION TASK:
    - Does the Scripture Text *explicitly contain* the information needed to answer the Question?
    - Is the Proposed Correct Answer *indisputably correct* according to THIS specific Scripture Text?
    
    Constraint: Ignore your own external Bible knowledge. Judge ONLY based on the text provided above. If the text does not contain the answer, you MUST return FAIL.

    Return JSON:
    {
        "rating": "PASS" | "FAIL",
        "explanation": "Brief justification."
    }
    `;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonStr);
    } catch (e) {
        return { rating: "ERROR", explanation: "AI Generation failed: " + e.message };
    }
}

const CONFIG = {
    baseUrl: 'http://localhost:3005',
    email: 'andre.ecprint@gmail.com',
    password: 'Andre@58078',
    durationMs: 30 * 60 * 1000, // 30 minutes
    questionsPerRound: 5,
};

// Utils
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Helper: Visual Click
// Moves mouse to element, highlights it, waits, then clicks
async function clickVisual(page, selectorOrElement, desc = "element") {
    let element;
    if (typeof selectorOrElement === 'string') {
        try {
            await page.waitForSelector(selectorOrElement, { timeout: 5000 });
            element = await page.$(selectorOrElement);
        } catch (e) {
            console.log(`   ❌ Could not find ${desc} (${selectorOrElement})`);
            return false;
        }
    } else {
        element = selectorOrElement;
    }

    if (!element) return false;

    // Scroll into view
    try {
        await element.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'center' }));

        // Highlight Red
        await element.evaluate(el => {
            el.style.outline = '4px solid red';
            el.style.boxShadow = '0 0 20px red';
            el.style.transition = 'all 0.2s';
        });

        await sleep(600); // Visual pause for user to see

        await element.click();

        // Remove highlight (optional, but page might nav anyway)
        await element.evaluate(el => {
            el.style.outline = '';
            el.style.boxShadow = '';
        }).catch(() => { }); // Ignore if element gone

        return true;
    } catch (e) {
        console.log(`   ⚠️ Error clicking ${desc}: ${e.message}`);
        return false;
    }
}

async function run() {
    console.log('🚀 Starting Trivia Automation Script...');
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized']
    });

    const page = await browser.newPage();

    // 1. LOGIN
    await login(page);

    // Handle Alerts
    page.on('dialog', async dialog => {
        // console.log('   🚨 Alert/Confirm:', dialog.message());
        await sleep(500);
        await dialog.accept();
    });

    const endTime = Date.now() + CONFIG.durationMs;
    let round = 0;

    // Cycling Configs
    const languages = ['en', 'af'];
    const testaments = ['OT', 'NT', 'BOTH'];
    const difficulties = ['easy', 'medium', 'hard'];

    // State for cycles
    let langIndex = 0;
    let testIndex = 0;
    let diffIndex = 0;

    console.log(`⏱️ Running for ${(CONFIG.durationMs / 1000 / 60)} minutes...`);

    while (Date.now() < endTime) {
        round++;
        console.log(`\n--- ROUND ${round} ---`);

        try {
            // 2. SET LANGUAGE
            const curLang = languages[langIndex % languages.length];
            await setLanguage(page, curLang);
            langIndex++;

            // 3. PLAY TRIVIA ROUND
            const curTestament = testaments[testIndex % testaments.length];
            const curDifficulty = difficulties[diffIndex % difficulties.length];

            // Advance indices
            testIndex++;
            if (testIndex % testaments.length === 0) {
                diffIndex++;
            }

            const played = await playTriviaRound(page, curLang, curTestament, curDifficulty, round);

            if (!played) {
                console.log('   ⏭️ Round skipped (limit/error), cooling down 5s...');
                await sleep(5000);
            }

        } catch (err) {
            console.error('   ❌ Round failed:', err.message);
            // await page.screenshot({ path: `error_round_${round}.png` });
            await sleep(2000);
        }
    }

    console.log('✅ Time limit reached. Automation complete.');
    await browser.close();
}

async function login(page) {
    console.log('🔑 Logging in...');
    await page.goto(`${CONFIG.baseUrl}/auth`, { waitUntil: 'domcontentloaded' });

    // Check if we are already redirected to profile
    if (page.url().includes('/profile')) {
        console.log('   Already logged in!');
        return;
    }

    // Wait for form
    try {
        await page.waitForSelector('input[type="email"]', { timeout: 5000 });

        console.log('   Entering Credentials...');
        await page.type('input[type="email"]', CONFIG.email); // Simple type is fine for new load
        await page.type('input[type="password"]', CONFIG.password);

        await clickVisual(page, 'button[type="submit"]', "Login Button");

        await page.waitForNavigation({ waitUntil: 'domcontentloaded' });
        console.log('   Login successful.');
    } catch (e) {
        console.log('   Login checks done (may be logged in).');
    }
}

async function setLanguage(page, langCode) {
    console.log(`🌍 Setting language to: ${langCode.toUpperCase()}`);
    // Only Nav if not there
    if (!page.url().includes('/profile')) {
        await page.goto(`${CONFIG.baseUrl}/profile`, { waitUntil: 'domcontentloaded' });
        await sleep(1000);
    }

    // Check current state first
    const buttons = await page.$$('.lang-btn');
    for (const btn of buttons) {
        const text = await btn.evaluate(node => node.innerText.toLowerCase());
        const isEnglishBtn = text.includes('english');
        const isAfrikaansBtn = text.includes('afrikaans');
        const isActive = await btn.evaluate(node => node.classList.contains('active'));

        if (langCode === 'en' && isEnglishBtn && !isActive) {
            await clickVisual(page, btn, "English Button");
            await sleep(500);
            console.log('   Switched to English');
        } else if (langCode === 'af' && isAfrikaansBtn && !isActive) {
            await clickVisual(page, btn, "Afrikaans Button");
            await sleep(500);
            console.log('   Switched to Afrikaans');
        }
    }
}

async function playTriviaRound(page, lang, testament, difficulty, round) {
    console.log(`🎮 Playing Trivia: [${testament}] [${difficulty}]`);
    await page.goto(`${CONFIG.baseUrl}/trivia`, { waitUntil: 'domcontentloaded' });
    await sleep(2000); // Wait for stats fetch

    // Check Limit
    const limitReached = await page.$('.limit-reached-card');
    if (limitReached) {
        console.log('   🔒 Daily limit reached (UI).');
        return false;
    }

    // SETUP
    const testMap = { 'OT': 0, 'NT': 1, 'BOTH': 2 };
    const diffMap = { 'easy': 0, 'medium': 1, 'hard': 2 };

    await page.waitForSelector('.testament-options', { timeout: 5000 }).catch(() => null);

    const testBtns = await page.$$('.testament-options .option-btn');
    if (testBtns[testMap[testament]]) {
        // Only click if not active?
        const active = await testBtns[testMap[testament]].evaluate(el => el.classList.contains('active'));
        if (!active) await clickVisual(page, testBtns[testMap[testament]], `Testament ${testament}`);
    }

    const diffBtns = await page.$$('.difficulty-options .option-btn');
    if (diffBtns[diffMap[difficulty]]) {
        const active = await diffBtns[diffMap[difficulty]].evaluate(el => el.classList.contains('active'));
        if (!active) await clickVisual(page, diffBtns[diffMap[difficulty]], `Difficulty ${difficulty}`);
    }

    await sleep(500);

    // START
    const startBtn = await page.$('.start-btn');
    if (!startBtn) {
        console.log('   Start button missing?');
        return false;
    }

    const disabled = await startBtn.evaluate(b => b.disabled);
    if (disabled) {
        console.log('   Start button disabled.');
        return false;
    }

    const clicked = await clickVisual(page, startBtn, "Start Quiz");
    if (!clicked) return false;

    // WAIT FOR QUESTION
    // Limit is 8s? AI takes longer. Let's do 25s.
    try {
        await page.waitForSelector('.question-card', { timeout: 25000 });
        console.log('   ✅ Game Started!');
    } catch (e) {
        // Check if alert appeared (handled by dialog listener)
        console.log('   ❌ Failed to load question (Timeout/Error). Moving on.');
        // await page.screenshot({ path: 'debug_start_fail.png' });
        return false;
    }

    // QUESTIONS LOOP
    for (let q = 1; q <= CONFIG.questionsPerRound; q++) {
        await sleep(1000); // Pace it
        console.log(`   Question ${q}/${CONFIG.questionsPerRound}`);

        // 1. Find Options
        try {
            await page.waitForSelector('.answer-btn', { timeout: 5000 });
        } catch (e) {
            console.log('   Wait for options timed out.');
            break;
        }

        const options = await page.$$('.answer-btn');
        if (options.length === 0) {
            console.log('   No options found.');
            break;
        }

        // 2. Pick Random
        const randomIdx = Math.floor(Math.random() * options.length);
        const opt = options[randomIdx];
        const optText = await opt.evaluate(el => el.innerText);

        await clickVisual(page, opt, `Option: ${optText}`);


        // Result & Debug
        try {
            await page.waitForSelector('.result-overlay', { timeout: 10000 });
        } catch (e) {
            console.log('   No result overlay?');
            break;
        }

        // --- NEW: Scrape Verse Text ---
        let verseText = "N/A";
        // Click the reference to open popup
        try {
            const refLink = await page.$('.verse-ref');
            if (refLink) {
                await clickVisual(page, refLink, "Verse Reference");

                // Wait a bit strongly for popup
                await page.waitForSelector('.verse-popup-content', { timeout: 4000 });

                // RETRY LOOP: Wait for text to populate (not be "Loading...")
                verseText = "N/A";
                // Increase wait to ~10 seconds (30 * 333ms)
                for (let k = 0; k < 30; k++) {
                    const el = await page.$('.verse-text');
                    if (el) {
                        const txt = await page.evaluate(e => e.innerText, el);
                        if (txt && !txt.includes('Loading')) {
                            verseText = txt;
                            break;
                        }
                    }
                    if (k % 5 === 0) console.log(`   ⏳ Waiting for verse text... (${k}/30)`);
                    await sleep(333);
                }

                // Close popup
                const closeBtn = await page.$('.close-popup-btn');
                if (closeBtn) await clickVisual(page, closeBtn, "Close Popup");
                await sleep(500); // Wait for close
            } else {
                console.log("   ⚠️ No verse reference link found.");
            }
        } catch (e) {
            console.log('   ⚠️ Could not fetch verse text:', e.message);
        }

        // 4. LOG RESULT TO FILE
        // Check correctness
        const isCorrect = await page.$('.correct-msg') !== null;
        const resultEmoji = isCorrect ? '✅' : '❌';

        // Get Debug Info from attribute
        const spans = await page.$$('span.clickable');
        let debugBtn = null;
        let debugJson = null;

        for (const s of spans) {
            const text = await s.evaluate(n => n.innerText);
            if (text.includes('📋')) {
                debugBtn = s;
                const data = await s.evaluate(n => n.getAttribute('data-debug-info'));
                if (data) debugJson = JSON.parse(data);
                break;
            }
        }


        // Determine Quality Rating via AI
        let rating = (verseText === "N/A") ? "FAIL (No Verse Text)" : "PENDING";
        let aiAnalysis = "N/A";
        let deletionStatus = "";

        if (debugJson && verseText !== "N/A") {
            const correctAnswer = debugJson.options[debugJson.debug.correctIndex];

            // AI VERIFICATION
            try {
                const analysis = await verifyWithAI(
                    debugJson.text,
                    correctAnswer,
                    verseText,
                    debugJson.debug?.verseRef?.en || debugJson.debug?.verseRef?.af || 'N/A'
                );
                rating = analysis.rating;
                aiAnalysis = analysis.explanation;

                // AUTO-DELETE IF FAIL
                if (rating === 'FAIL') {
                    console.log(`   🗑️ AI RATING FAIL. Deleting Question ID: ${debugJson.id}`);
                    const { error } = await supabase.from('trivia_questions').delete().eq('id', debugJson.id);
                    if (error) {
                        deletionStatus = `DELETE FAILED: ${error.message}`;
                        console.log(`   ❌ Delete failed: ${error.message}`);
                    } else {
                        deletionStatus = "🗑️ DELETED FROM DB";
                        console.log(`   ✅ Question deleted successfully.`);
                    }
                }

            } catch (e) {
                console.log('   Warning: AI Verification failed', e.message);
                // Fallback
                const normVerse = verseText.toLowerCase();
                const normAns = correctAnswer.toString().toLowerCase();
                if (normVerse.includes(normAns)) {
                    rating = "PASS (Fallback)";
                    aiAnalysis = "Simple string match confirmed.";
                } else {
                    rating = "FAIL (Fallback)";
                    aiAnalysis = "String match failed. AI unreachable.";
                }
            }
        }

        if (debugJson) {
            const fs = await import('fs');
            const logEntry = `
---------------------------------------------------
[${new Date().toISOString()}] Round ${round} - Q${q}
Language: ${lang.toUpperCase()} | Testament: ${testament} | Diff: ${difficulty}
Question: ${debugJson.text}
Options: ${debugJson.options.join(', ')}
Correct Answer: ${debugJson.options[debugJson.debug?.correctIndex]}
Verse Ref: ${debugJson.debug?.verseRef?.en || debugJson.debug?.verseRef?.af || 'N/A'}
Verse Text: "${verseText}"

Result: ${resultEmoji} ${isCorrect ? 'Correct' : 'Incorrect'}
AI Rating: ${rating}
AI Analysis: ${aiAnalysis}
Action: ${deletionStatus}
---------------------------------------------------
`;
            fs.appendFileSync('trivia_test_log.txt', logEntry);
            console.log(`   📝 Logged result. AI Rating: ${rating} ${deletionStatus}`);
        } else {
            console.log('   ⚠️ Could not read debug info from DOM.');
        }

        await sleep(1000);

        // 5. Next Question
        const nextBtn = await page.$('.next-btn');
        if (nextBtn) {
            await clickVisual(page, nextBtn, "Next Button");
            // Wait for next question or end?
            await sleep(1000);
            // If next question loads, .question-text changes. 
            // We just loop.
        } else {
            console.log('   No next button - End of session?');
            break;
        }
    }

    return true;
}

run().catch(console.error);
