import { supabase } from '../config/supabaseClient';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { logApiCall } from './adminService';

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

/**
 * TRIVIA SERVICE
 * Handles daily limits, question fetching, answering, and AI question generation.
 */

// ==========================================
// LIMIT LOGIC
// ==========================================

export const checkDailyLimit = async (userId) => {
    try {
        if (!userId) return { allowed: false, error: 'User not logged in' };

        // 1. Get User Profile for Tier
        const { data: profile, error: pError } = await supabase
            .from('user_profiles')
            .select('subscription_tier, subscription_override, subscription_expiry, email')
            .eq('user_id', userId)
            .single();

        if (pError && pError.code !== 'PGRST116') throw pError;

        const override = profile?.subscription_override;
        const expiry = profile?.subscription_expiry;
        const isPremium = profile?.subscription_tier === 'premium' ||
            override === 'premium' ||
            override === 'tester' ||
            (expiry && new Date(expiry) > new Date());

        const isAdmin = override === 'admin';

        // 2. Define Limits
        let dailyLimit = 20; // Regular
        if (isPremium) dailyLimit = 100; // Premium/Tester
        if (isAdmin) dailyLimit = 999999; // Unlimited

        // 3. Get Today's Usage
        const today = new Date().toISOString().split('T')[0];
        const { data: daily, error: dError } = await supabase
            .from('user_trivia_daily')
            .select('count')
            .eq('user_id', userId)
            .eq('date', today)
            .maybeSingle();

        if (dError && dError.code !== 'PGRST116') throw dError;

        const currentCount = daily?.count || 0;
        const remaining = Math.max(0, dailyLimit - currentCount);

        return {
            allowed: currentCount < dailyLimit,
            limit: dailyLimit,
            current: currentCount,
            remaining,
            isPremium,
            isAdmin
        };

    } catch (err) {
        console.error('Error checking trivia limit:', err);
        return { allowed: false, error: err.message };
    }
};

// ==========================================
// GAMEPLAY LOGIC
// ==========================================

export const fetchQuestion = async (userId, difficulty = 'medium', testament = 'NT', language = 'en') => {
    try {
        // 1. Check Limits First
        const limitCheck = await checkDailyLimit(userId);
        if (!limitCheck.allowed) {
            return { success: false, error: 'DAILY_LIMIT_REACHED', limitInfo: limitCheck };
        }

        // 2. Get history to exclude (last 360 days)
        // We can do this via a "not.in" query, but if history is huge, it's slow.
        // Better: use an RPC or do a left join approach. For now, we'll fetch ID list or rely on Postgres advanced query if possible.
        // Simple approach: Fetch fetched IDs first? No, too many.
        // Optimized: Let's assume we randomly select ONE from candidates.

        // We'll use a Supabase RPC if we had it. Without it, we might try to pull a batch of "potential" IDs and filter in JS if needed, 
        // OR rely on AI generation if the DB is small. 
        // Given this is a new feature, DB is empty. So we will almost CERTAINLY hit the AI fallback initially.

        // Let's try to fetch a random question provided it's NOT in the history.
        // We can filter history on client if it's small, but that scales poorly.
        // Instead, let's fetch IDs of answered questions for this user.
        const { data: history, error: hError } = await supabase
            .from('user_trivia_history')
            .select('question_id')
            .eq('user_id', userId)
            .gte('answered_at', new Date(Date.now() - 360 * 24 * 60 * 60 * 1000).toISOString()); // 360 days

        if (hError) throw hError;

        const excludeIds = history.map(h => h.question_id);

        // Fetch candidates (limit 20 random ones, then pick 1 that isn't excluded)
        // Note: Supabase doesn't support 'random' sort easily without RPC 'order by random()'.
        // We can try to fetch a batch that matches criteria and filter.

        // Build base filters
        const buildQuery = () => {
            let q = supabase
                .from('trivia_questions')
                .select('*')
                .eq('difficulty', difficulty.toLowerCase());

            // Correct column usage (Only filter if not BOTH)
            if (testament !== 'BOTH') {
                q = q.eq('testament', testament);
            }
            return q;
        };

        // Fetch count to enable random offset
        const { count, error: cError } = await buildQuery().select('*', { count: 'exact', head: true });

        if (cError) throw cError;

        let data = [];
        if (count > 0) {
            // If we have many questions, pick a random starting point
            // We want to fetch ~50 candidates.
            const maxOffset = Math.max(0, count - 50);
            const randomOffset = Math.floor(Math.random() * (maxOffset + 1));

            const { data: candidates, error: qError } = await buildQuery()
                .range(randomOffset, randomOffset + 49);

            if (qError) throw qError;
            data = candidates;
        }

        const candidates = data || [];



        // Filter excluded
        const available = candidates.filter(q => !excludeIds.includes(q.id));

        if (available.length > 0) {
            // Return random one from available
            const randomQ = available[Math.floor(Math.random() * available.length)];
            return { success: true, question: formatQuestionForClient(randomQ, language) };
        }

        // 2b. [NEW] Get recent tags to avoid semantic duplicates
        // We fetch the detailed question data for the excludeIds
        let recentTexts = [];
        if (excludeIds.length > 0) {
            // Fetch last 15 answered questions 
            const { data: recentQs } = await supabase
                .from('trivia_questions')
                .select('question_text_en')
                .in('id', excludeIds.slice(0, 15)); // Check last 15

            if (recentQs) {
                recentTexts = recentQs.map(q => q.question_text_en);
            }
        }

        // 3. Fallback: GENERATE via AI if no unplayed questions found
        console.log("⚠️ No unique questions found. Generating fresh via AI...");
        const newQuestion = await generateQuestionViaAI(difficulty, testament, excludeIds, recentTexts, language);

        if (newQuestion) {
            // It's already saved to DB by the generator function
            return { success: true, question: formatQuestionForClient(newQuestion, language) };
        }

        return { success: false, error: 'Could not find or generate a question.' };

    } catch (err) {
        console.error('Error fetching question:', err);
        return { success: false, error: err.message };
    }
};

/**
 * Syncs the local daily count to the server.
 * Call this periodically (e.g. every 5 questions) or on exit.
 */
export const syncDailyProgress = async (userId, count) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const { error } = await supabase
            .from('user_trivia_daily')
            .upsert({
                user_id: userId,
                date: today,
                count: count
            }, { onConflict: 'user_id,date' });

        if (error) throw error;
        return { success: true };
    } catch (err) {
        console.error('Error syncing progress:', err);
        return { success: false, error: err.message };
    }
};

export const submitAnswer = async (userId, questionId, selectedIndex) => {
    try {
        // 1. Fetch Question to verify answer (Server-side verification pattern)
        const { data: question, error: qError } = await supabase
            .from('trivia_questions')
            .select('correct_index, verse_ref_en, verse_ref_af')
            .eq('id', questionId)
            .single();

        if (qError) throw qError;

        const isCorrect = (question.correct_index === selectedIndex);

        // 2. Record History (Always record history for uniqueness check)
        const { error: hError } = await supabase
            .from('user_trivia_history')
            .insert({
                user_id: userId,
                question_id: questionId,
                is_correct: isCorrect,
                answered_at: new Date().toISOString()
            });

        if (hError) throw hError;

        // NOTE: We NO LONGER update daily count here to prevent overflow.
        // The client must call syncDailyProgress() when appropriate.

        return {
            success: true,
            isCorrect,
            correctIndex: question.correct_index,
            verseRef: { en: question.verse_ref_en, af: question.verse_ref_af }
        };

    } catch (err) {
        console.error('Error submitting answer:', err);
        return { success: false, error: err.message };
    }
};


// ==========================================
// HELPERS
// ==========================================

const formatQuestionForClient = (dbQuestion, language) => {
    // Return only necessary data (hide correct index initially if we want strict security, 
    // but typically we verify on submit. For now we just don't send 'correct_index' logic here if we verify on server)
    const isAf = language === 'af';
    return {
        id: dbQuestion.id,
        text: isAf ? dbQuestion.question_text_af : dbQuestion.question_text_en,
        options: isAf ? dbQuestion.options_af : dbQuestion.options_en,
        difficulty: dbQuestion.difficulty,
        // Expose debug info for "Copy All" feature (safe since this is a trivia app, not a high-stakes exam)
        debug: {
            correctIndex: dbQuestion.correct_index,
            verseRef: {
                en: dbQuestion.verse_ref_en,
                af: dbQuestion.verse_ref_af
            },
            verification: dbQuestion.verification_data // Note: This might be null for old questions
        }
    };
};

const generateQuestionViaAI = async (difficulty, testament, excludeIds, recentTexts = [], language) => {
    let attempts = 0;
    let feedback = ""; // [NEW] Feedback for retry loop

    while (attempts < 5) { // Increased from 3 to 5
        attempts++;
        try {
            console.log(`🤖 AI Generation Attempt ${attempts}...`);

            // Resolve BOTH to explicit 50/50 choice for AI to prevent bias
            let effectiveTestament = testament;
            if (testament === 'BOTH') {
                effectiveTestament = Math.random() < 0.5 ? 'OT' : 'NT';
            }

            let difficultyDesc = "";
            let gradeLevel = "Grade 6";

            if (difficulty === 'easy') {
                difficultyDesc = "EXTREMELY SIMPLE and BROADLY KNOWN. Focus on major Bible characters (Noah, David, Jesus, Moses) and famous events. The question should be suitable for a 10-year-old child (Grade 4).";
                gradeLevel = "Grade 4";
            } else if (difficulty === 'medium') {
                difficultyDesc = "MODERATELY CHALLENGING. Requires a good understanding of main Bible stories and secondary characters. Suitable for a teenager (Grade 8).";
                gradeLevel = "Grade 8";
            } else {
                difficultyDesc = "ADVANCED and OBSCURE. Can include theological nuances, minor characters, or specific details found in the text. Suitable for a high school graduate or theologian (Grade 12 and above).";
                gradeLevel = "Grade 12+";
            }

            const testamentDesc = effectiveTestament === 'OT' ? "Old Testament" : "New Testament";

            const avoidList = recentTexts.join('\n- ');
            const avoidInstruction = recentTexts.length > 0
                ? `CRITICAL EXCLUSION LIST (Do NOT generate similar questions):\n- ${avoidList}\n\nRule: Do not ask about the same specific event or fact as the questions above.`
                : "";

            // [NEW] Inject feedback if previous attempt failed
            const retryInstruction = feedback
                ? `\n\n⚠️ PREVIOUS ATTEMPT REJECTED: ${feedback} \nYOU MUST CORRECT THIS VIOLATION.`
                : "";


            const prompt = `Generate a UNIQUE Bible trivia question.
            parameters:
            - Difficulty Level: ${difficultyDesc}
            - Targeted Complexity: ${gradeLevel}
            - Testament: ${testamentDesc}
            - Language: Create both English and Afrikaans versions.
            - VERSIONS: Use 'New King James Version' (NKJV) for English and 'Afrikaans 1953' (AFR53) for Afrikaans. Ensure names/facts match these specific translations.
            
            ${avoidInstruction}
            ${retryInstruction}
            
            CRITICAL RULES (STRICT ADHERENCE REQUIRED):
            1. **SOURCE OF TRUTH**: The answer must be found **VERBATIM** in the single verse you cite.
            2. **NO EXTERNAL KNOWLEDGE**: Do NOT use common knowledge. If the text says "wise men" but not "3", do NOT ask "How many?".
            3. **NO CONTEXT LEAKAGE**: Do not ask about events in previous/next verses. The Answer must be in THIS specific verse.
            4. **NO COUNTING / NO NUMBERS**: ABSOLUTE BAN on questions where the answer is a quantity, number, or digit. 
               - BAD: "How many..." -> Answer: "6" (REJECT THIS)
               - BAD: "What was the height..." -> Answer: "6 cubits" (REJECT THIS)
               - GOOD: "Who...", "Where...", "What object..." -> Answer: "David", "Jerusalem", "Staff"
            5. **LOGICAL CONSISTENCY**: The Question Type MUST match the Reference content. 
               - If the verse describes an ACTION (e.g., "He built an altar"), ask "What did he do?". Do NOT ask "What did he name it?" unless a name is explicitly written.
               - Don't force a "Who" question if the verse only details an event.
            6. **BOOK CONSISTENCY**: The book mentioned in the question must match the reference.
            6. **SPELLING**: Use the EXACT spelling found in the verse text.
            7. **CONTEXT MATCHING**: Ensure the cited Verse Reference *actually contains* the names/events in your question. (e.g. Do not cite Judges 8 for a question about Barak if Barak isn't in Judges 8).
            8. **SIMPLE LANGUAGE**: Use ${gradeLevel} reading level. Simplify the **Question Text** syntax. Avoid archaic words in the question phrasing. Use standard, modern English/Afrikaans.

            Requirements:
            - Question Text: Clear, concise.
            - Options: 3 distinct options (1 correct, 2 plausible distractors).
            - Reference: Provide the exact Bible verse that proves the answer.

            Return a JSON object:
            {
                "question_en": "...",
                "question_af": "...",
                "options_en": ["9", "5", "3"], // Ensure correct answer is in this list
                "options_af": ["9", "5", "3"], // Corresponding translations
                "correct_index": 0, // 0, 1, or 2 (Randomize this!)
                "verse_ref_en": "Book Chapter:Verse",
                "verse_ref_af": "Boek Hoofstuk:Vers",
                "tags": ["People", "War", etc],
                "verification": "STEP 1: Quote text. STEP 2: Does text ALONE contain answer? STEP 3: Does question Book Name match Reference? (YES/NO). STEP 4: Confirm spelling."
            }
            `;

            const result = await model.generateContent(prompt);
            await logApiCall('trivia_generation', 'success', 'gemini-2.0-flash', {
                difficulty,
                testament: effectiveTestament,
                attempt: attempts
            });
            const text = result.response.text();
            const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const data = JSON.parse(jsonStr);

            // Validation: Verify correct_index is 0-2
            if (data.correct_index < 0 || data.correct_index > 2) data.correct_index = 0;

            // [STRICT VALIDATION] Reject ANY question with numeric-only answers
            // Filters out: "6", "100", "six", "one hundred"
            const numRegex = /^(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand)\b/i;
            const hasNumericAnswer = [...data.options_en, ...data.options_af].some(opt =>
                !isNaN(opt) || numRegex.test(opt.trim())
            );

            if (hasNumericAnswer) {
                console.warn("⚠️ AI generated numeric answers despite rules. RETRYING...");
                feedback = "You generated NUMERIC answers (digits or number words). This is BANNED. Generate a question about a PERSON, PLACE, or OBJECT instead.";
                continue; // Skip this iteration and try again
            }

            // [STRICT VALIDATION] Reject "How many" questions (Counting)
            // Filters out: "How many sons...", "Hoeveel seuns..."
            const countRegex = /(how many|quantity|number of|hoeveel)/i;
            if (countRegex.test(data.question_en) || countRegex.test(data.question_af)) {
                console.warn("⚠️ AI generated a 'How many' question. RETRYING...");
                feedback = "You asked 'How many'. This is BANNED. Do NOT ask for counts. Ask 'Who', 'What', or 'Where'.";
                continue;
            }

            // CHECK IF EXISTS (Prevent Duplicates / Reuse)
            const { data: existing } = await supabase
                .from('trivia_questions')
                .select('*') // Select all fields so we can return it
                .eq('question_text_en', data.question_en)
                .maybeSingle();

            if (existing) {
                console.log("⚠️ Generated question already exists in DB. ID:", existing.id);
                // If user has already seen this specific question ID, we must retry
                if (excludeIds.includes(existing.id)) {
                    console.log("♻️ User has seen this duplicate. Retrying generation...");
                    feedback = "That question already exists. Generate a totally different one.";
                    continue; // RETRY LOOP
                }
                // If exists but user hasn't seen it, Reuse it! (Saves DB space)
                console.log("✅ Reuse existing question (User hasn't seen it).");
                return existing;
            }

            // Save to DB (New Unique Question)
            const { data: savedQ, error } = await supabase
                .from('trivia_questions')
                .insert({
                    question_text_en: data.question_en,
                    question_text_af: data.question_af,
                    options_en: data.options_en,
                    options_af: data.options_af,
                    correct_index: data.correct_index,
                    verse_ref_en: data.verse_ref_en,
                    verse_ref_af: data.verse_ref_af,
                    testament: effectiveTestament,
                    difficulty: difficulty.toLowerCase(),
                    tags: data.tags
                })
                .select()
                .single();

            if (error) {
                // If unique constraint error happens here (race condition), just retry
                if (error.code === '23505') { // Unique violation
                    console.warn("Constraint collision on insert. Retrying...");
                    continue;
                }
                console.error("DB Insert Error for AI Question:", error);
                return null;
            }

            return savedQ;

        } catch (e) {
            console.error("AI Generation Error:", e);
            // Don't retry on hard errors immediately, or maybe do?
            // Let's just continue to retry
        }
    }
    return null; // Failed after 3 attempts
};

export const getTriviaStats = async (userId) => {
    if (!userId) return null;

    try {
        // 1. Get total correct / total answered
        const { count: total } = await supabase
            .from('user_trivia_history')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);

        const { count: correct } = await supabase
            .from('user_trivia_history')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('is_correct', true);

        // 2. Calculate Current Consecutive Streak
        // Fetch up to 100 most recent records
        const { data: history } = await supabase
            .from('user_trivia_history')
            .select('is_correct')
            .eq('user_id', userId)
            .order('answered_at', { ascending: false })
            .limit(100);

        let currentStreak = 0;
        if (history && history.length > 0) {
            for (const record of history) {
                if (record.is_correct) {
                    currentStreak++;
                } else {
                    break; // Stop at first incorrect
                }
            }
        }

        // 3. Get Today's Count
        const { data: daily } = await supabase
            .from('user_trivia_daily')
            .select('count')
            .eq('user_id', userId)
            .eq('date', new Date().toISOString().split('T')[0])
            .maybeSingle();

        return {
            totalAnswered: total || 0,
            totalCorrect: correct || 0,
            currentStreak: currentStreak,
            todayCount: daily?.count || 0
        };
    } catch (err) {
        console.error("Error fetching trivia stats:", err);
        return {
            totalAnswered: 0,
            totalCorrect: 0,
            currentStreak: 0,
            todayCount: 0
        };
    }
};
