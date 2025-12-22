import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from '../config/supabaseClient';
import { logApiCall } from './adminService';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }); // Use latest flash model

// System prompt for biblical accuracy
const SYSTEM_PROMPT = `You are a Bible study assistant with comprehensive knowledge of the Bible. Follow these rules:

1. Use your biblical knowledge to answer questions fully and accurately
2. ALWAYS cite specific verse references (e.g., [[John 3:16]]) for your claims
3. If context verses are provided, prioritize using them
4. If no context verses are provided, use your general biblical knowledge to answer
5. Format responses clearly with paragraphs
6. Keep responses biblical, factual, and reverent
7. Maximum 400 words per response
8. Use [[Book Chapter:Verse]] format for all scripture citations (e.g., [[Genesis 1:1]])

You are a knowledgeable Bible teacher. Answer with confidence and cite scripture.`;

/**
 * Calculate adaptive daily quota based on active users
 * Formula: min(300, max(10, floor(1500 / active_users)))
 */
export async function calculateDailyQuota() {
    try {
        const today = new Date().toISOString().split('T')[0];

        // Count unique active users today (those who searched or asked AI)
        const { data: questionUsers, error: qError } = await supabase
            .from('ai_questions')
            .select('user_id')
            .gte('created_at', today);

        const { data: searchUsers, error: sError } = await supabase
            .from('search_logs')
            .select('user_id')
            .gte('created_at', today);

        if (qError || sError) {
            console.error('Error counting users:', qError || sError);
            return 10; // Safe fallback
        }

        // Combine and count unique users
        const allUsers = new Set([
            ...(questionUsers || []).map(u => u.user_id),
            ...(searchUsers || []).map(u => u.user_id)
        ]);

        const uniqueUsers = allUsers.size || 1; // At least 1

        // Calculate quota
        let quota = Math.floor(1500 / uniqueUsers);

        // Apply caps
        if (quota > 300) quota = 300;  // Max
        if (quota < 10) quota = 10;    // Min guarantee

        // Update global quota
        await supabase
            .from('ai_quota')
            .update({
                current_quota: quota,
                active_users_count: uniqueUsers,
                last_calculated: new Date().toISOString()
            })
            .eq('id', 1);

        return quota;

    } catch (error) {
        console.error('Quota calculation error:', error);
        return 10; // Safe fallback
    }
}

/**
 * Get current global quota
 */
export async function getCurrentQuota() {
    try {
        const { data, error } = await supabase
            .from('ai_quota')
            .select('current_quota, last_calculated')
            .eq('id', 1)
            .single();

        if (error) throw error;

        // Recalculate if last calculation was > 1 hour ago
        const lastCalc = new Date(data.last_calculated);
        const hoursSince = (Date.now() - lastCalc.getTime()) / (1000 * 60 * 60);

        if (hoursSince > 1) {
            return await calculateDailyQuota();
        }

        return data.current_quota;

    } catch (error) {
        console.error('Get quota error:', error);
        return 10; // Safe fallback
    }
}

/**
 * Check if user has remaining quota
 */
export async function getUserRemainingQuota(userId) {
    try {
        const today = new Date().toISOString().split('T')[0];
        const currentQuota = await getCurrentQuota();

        // Count questions asked today
        const { data, error } = await supabase
            .from('ai_questions')
            .select('id')
            .eq('user_id', userId)
            .gte('created_at', today);

        if (error) throw error;

        const used = data?.length || 0;
        const remaining = Math.max(0, currentQuota - used);

        return { remaining, used, quota: currentQuota };

    } catch (error) {
        console.error('Check quota error:', error);
        return { remaining: 0, used: 0, quota: 10 };
    }
}

/**
 * Generate hash for caching (browser-compatible)
 */
function hashQuestion(question) {
    const text = question.toLowerCase().trim();
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        const char = text.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
}

/**
 * Get cached answer if exists
 */
export async function getCachedAnswer(question) {
    try {
        const hash = hashQuestion(question);

        const { data, error } = await supabase
            .from('ai_cache')
            .select('*')
            .eq('question_hash', hash)
            .single();

        if (error || !data) return null;

        // Update hit count
        await supabase
            .from('ai_cache')
            .update({
                hit_count: data.hit_count + 1,
                updated_at: new Date().toISOString()
            })
            .eq('id', data.id);

        return data.answer;

    } catch (error) {
        console.error('Cache lookup error:', error);
        return null;
    }
}

/**
 * Save answer to cache
 */
export async function saveCachedAnswer(question, answer) {
    try {
        const hash = hashQuestion(question);

        await supabase
            .from('ai_cache')
            .upsert({
                question_hash: hash,
                question: question.trim(),
                answer: answer,
                hit_count: 1,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'question_hash'
            });

    } catch (error) {
        console.error('Cache save error:', error);
    }
}

/**
 * Main function: Ask AI a Bible question
 */
export async function askBibleQuestion(userId, question, verses = []) {
    try {
        // 1. Check quota
        const { remaining } = await getUserRemainingQuota(userId);
        if (remaining <= 0) {
            return {
                success: false,
                error: 'Daily quota exceeded. Try again tomorrow!',
                quotaExceeded: true
            };
        }

        // 2. Check cache first
        const cachedAnswer = await getCachedAnswer(question);
        if (cachedAnswer) {
            // Log as cached
            await supabase
                .from('ai_questions')
                .insert({
                    user_id: userId,
                    question: question,
                    answer: cachedAnswer,
                    cached: true
                });

            return { success: true, answer: cachedAnswer, cached: true };
        }

        // 3. Build prompt with verse context
        const contextText = verses.length > 0 ? verses.map(v =>
            `${v.book} ${v.chapter}:${v.verse} - "${v.text}"`
        ).join('\n\n') : 'No specific verses found';

        let userPrompt = SYSTEM_PROMPT + "\n\n";
        userPrompt += "**Context Verses (Reference Only):**\n";
        userPrompt += contextText + "\n\n";
        userPrompt += "**User Question:** " + question + "\n\n";
        userPrompt += "Provide a biblical answer.\n";
        userPrompt += "1. PRIORITIZE using the Context Verses above if they are relevant.\n";
        userPrompt += "2. If the Context Verses are not relevant, use your general biblical knowledge to answer.\n";
        userPrompt += "3. CRITICAL: You MUST cite verses in this EXACT format: [[Book Chapter:Verse]] (e.g., [[John 3:16]]). Do not use parentheses `()` for citations, use double brackets `[[]]`.\n";
        userPrompt += "4. If you cannot find a direct biblical answer, admit it.";

        // 4. Call Gemini AI
        const result = await model.generateContent(userPrompt);
        const response = await result.response;
        const answer = response.text();

        // Log successful API call
        logApiCall('askBibleQuestion', 'success', 'gemini-2.0-flash', { userId });

        // 5. Save to cache (for reuse) - Non-blocking
        saveCachedAnswer(question, answer).catch(console.error);

        // 6. Log and Increment - Non-blocking / Separate try-catch
        try {
            await supabase
                .from('ai_questions')
                .insert({
                    user_id: userId,
                    question: question,
                    answer: answer,
                    cached: false,
                    verse_context: contextText,
                    device_info: navigator.userAgent
                });

            // 7. Increment API call counter
            await supabase.rpc('increment', {
                table_name: 'ai_quota',
                column_name: 'total_api_calls_today'
            });
        } catch (dbError) {
            console.warn("Background logging failed, but answer was generated:", dbError);
        }

        return { success: true, answer, cached: false };

    } catch (error) {
        console.error('AI question error:', error);
        // Log failed API call
        logApiCall('askBibleQuestion', 'error', 'gemini-2.0-flash', { userId, error: error.message });

        // More specific error messages
        let errorMessage = 'Failed to get AI response. Please try again.';

        const errMsg = error.message?.toLowerCase() || '';

        if (errMsg.includes('quota') || errMsg.includes('limit') || errMsg.includes('rate') || errMsg.includes('429')) {
            errorMessage = 'Google AI rate limit reached. Please wait a minute and try again.';
        } else if (errMsg.includes('api key') || errMsg.includes('api_key') || errMsg.includes('invalid')) {
            errorMessage = 'API configuration error. Please contact support.';
        } else if (errMsg.includes('network') || errMsg.includes('fetch') || errMsg.includes('Failed to fetch')) {
            errorMessage = 'Network error. Please check your connection and try again.';
        } else if (errMsg.includes('timeout')) {
            errorMessage = 'Request timed out. Please try again.';
        } else if (errMsg.includes('blocked') || errMsg.includes('safety')) {
            errorMessage = 'Content was blocked by safety filters. Please rephrase your question.';
        } else if (errMsg.includes('model') || errMsg.includes('not found')) {
            errorMessage = 'AI model error. Please try again later.';
        }

        return {
            success: false,
            error: errorMessage,
            details: error.message
        };
    }
}
/**
 * Get AI hints for Inductive Bible Study steps
 */
export async function getInductiveStudyHints(userId, step, bookName, chapter, verseStart, verseEnd, language = 'en') {
    try {
        const { remaining } = await getUserRemainingQuota(userId);
        if (remaining <= 0) return { success: false, error: 'Quota exceeded' };

        const ref = `${bookName} ${chapter}:${verseStart}${verseEnd && verseEnd !== verseStart ? '-' + verseEnd : ''}`;

        let prompt = `You are a Bible study assistant helping a user with the Inductive Bible Study method for the passage: ${ref}. 
        The language should be: ${language === 'af' ? 'Afrikaans' : 'English'}.
        
        Current Step: ${step} (1=Observation, 2=Interpretation, 3=Application).
        
        Rules:
        - If Step 1 (Observation): Provide a concise list of Who, What, Where, When, Why, How. Suggest 3-5 repeated "Key Words" or "Themes". Identify any prominent Commands or Promises.
        - If Step 2 (Interpretation): Provide the historical context, author information, and the original intended meaning for the first audience. Suggest 2-3 related cross-references.
        - If Step 3 (Application): Suggest 3 practical, personal application points and one concrete "Action Step".
        
        Format the response as a valid JSON object with the following structure:
        {
            "hints": {
                // If step 1: 
                "who": "...", "what": "...", "where": "...", "keywords": ["...", "..."], "commands": "...", "promises": "..."
                // If step 2:
                "author": "...", "context": "...", "meaning": "...", "crossRefs": "..."
                // If step 3:
                "god": "...", "myself": "...", "change": "...", "action": "..."
            }
        }`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Log successful API call
        logApiCall('getInductiveStudyHints', 'success', 'gemini-2.0-flash', { userId, step, ref });

        // Clean markdown JSON if present
        const jsonStr = text.replace(/```json\n?|\n?```/g, '').trim();
        const data = JSON.parse(jsonStr);

        // Map data back to log
        await supabase.from('ai_questions').insert({
            user_id: userId,
            question: `Inductive Hint Step ${step} for ${ref}`,
            answer: text,
            cached: false
        });

        return { success: true, hints: data.hints };
    } catch (error) {
        console.error('Study hints error:', error);
        logApiCall('getInductiveStudyHints', 'error', 'gemini-2.0-flash', { userId, error: error.message });
        return { success: false, error: error.message };
    }
}

/**
 * Get deep analysis for a specific word or verse in original languages
 */
export async function getWordStudy(userId, verseRef, verseText, originalText, selectedWord = null, language = 'en') {
    try {
        const { remaining } = await getUserRemainingQuota(userId);
        if (remaining <= 0) return { success: false, error: 'Quota exceeded' };

        // 1. Lexical Danger List & Specific Rules
        const LEXICAL_DANGER_LIST = {
            'agape': 'Must explicitly deny that it ALWAYS means divine love. Cite John 3:19 or 2 Tim 4:10 as counterexamples.',
            'agapao': 'Must explicitly deny that it ALWAYS means divine love. Cite John 3:19 or 2 Tim 4:10 as counterexamples.',
            'monogenes': 'Must define as "unique" or "one of a kind". Disallow "only begotten" unless explained as a historical mistranslation.',
            'sarx': 'Must clarify it does not always mean "sinful nature" but often just physical body (e.g., John 1:14).',
            'kosmos': 'Distinguish between "physical world", "humanity", and "world system" opposed to God.',
            'pistis': 'Define primarily as "trust/allegiance" not just mental assent.'
        };

        const dangerInstruction = selectedWord && LEXICAL_DANGER_LIST[selectedWord.toLowerCase().replace(/[^\w]/g, '')]
            ? `\n\nCRITICAL DANGER WORD RULE: ${LEXICAL_DANGER_LIST[selectedWord.toLowerCase().replace(/[^\w]/g, '')]}`
            : '';

        let prompt = `Generate biblical word studies by first identifying grammatical form, then determining meaning strictly from immediate context and authorial usage, before consulting lexical ranges. Avoid absolute definitions, prevent grammar-based theological claims, and include at least one counterexample or usage caution where the word carries a different sense elsewhere. Theology must arise from textual usage, not lexicon alone. High-risk words require explicit clarification notes. Use qualifying language ("in this context") and ensure interpretations could withstand academic scrutiny.

        CRITICAL INSTRUCTION: You MUST provide ALL explanations, definitions, and nuances in ${language === 'af' ? 'AFRIKAANS' : 'ENGLISH'}.
        
        Verse Reference: ${verseRef}
        Translation Text: "${verseText}"
        Original Language Text: "${originalText}"
        ${selectedWord ? `Target Word to Study: "${selectedWord}"` : 'General Verse Analysis (Original Languages focus)'}
        ${dangerInstruction}

        STRICT PROTOCOL - DECISION LAYERS:
        
        1. FORM RECOGNITION (Non-Negotiable input)
           - Identify Surface form, Lemma, Part of Speech, Case/Tense/Stem/Voice.
           - Rule: Never interpret meaning until grammatical form is stated.

        2. MEANING HIERARCHY (Follow order)
           - Grammar -> Immediate Context -> Authorial Usage -> Lexical Range -> Theology.
           - Rule: Theology is an outcome, never an input.

        3. GRAMMAR-TO-THEOLOGY FIREWALL
           - Prevent tense fallacies (e.g., Aorist does not equal "once for all").
           - Mandatory Phrase Injection: "In this context...", "As used here...".

        4. EMPHASIZE FUNCTION OVER ABSTRACT DEFINITION
           - Explain what the word DOES in the verse, not only what it can mean lexically
           - Describe how meaning is revealed through action, relationship, covenant, command, or response

        5. RELATED FORMS RULE (CRITICAL)
           - Only include related nouns/verbs (e.g., ἀγαπάω ↔ ἀγάπη) if the relationship is lexical/semantic.
           - Do NOT transfer meaning from a related word unless context supports it.
           - Never imply derivation or meaning transfer unless explicitly supported.

        6. USE LEXICONS RESPONSIBLY
           - Base definitions on recognized sources (BDAG, HALOT, BDB)
           - Present definitions as ranges of meaning, narrowed by context.

        7. NEGATIVE CONTROLS (Counterexample)
           - Prove the word does not ALWAYS mean this.
           - Rule: Include at least one example where the same word is used differently or negatively.
        
        8. SCHOLAR TEST
            - "Would this interpretation survive a first-year seminary classroom?"
            - If no -> downgrade certainty tag.

        HEBREW/ARAMAIC SPECIFIC REFINEMENTS (Apply when analyzing Hebrew/OT texts):
        
        A. GENDER RESTRAINT
           - Do not specify "Masculine" / "Feminine" for nouns unless it affects agreement or interpretation.
           - Default to "Noun (Singular / Plural)" if gender is not contextually relevant.

        B. IDIOMATIC RESPECT
           - Treat phrases like "find favor in the eyes of" as whole units.
           - Explain the idiom's total meaning (perception/standing) rather than dissecting components.

        C. VERB AGENCY & NARRATIVE LOGIC
           - Do not rephrase stative verbs as explicit divine actions unless grammatically supported.
           - Describe "favor" or "grace" as relational standing, not implied causation.
           - Do NOT import Pauline theology (e.g., "unmerited grace") into OT narrative unless explicitly present.
           - Case Study: If "righteousness" and "favor" coexist (Gen 6:8-9), treat as co-existing facts, not causal explanations.

        D. MANDATORY NEGATIVE CONTROLS (Targeting Abstract Nouns)
           - For words with secular & theological range (e.g., חֵן/Chen), explicitly state usage cautions.
           - Always provide a counterexample where the word is used non-theologically.

        REQUIRED: Include at least one qualifying phrase per section: "In this context...", "As used here...", or "Within this passage..."

        Format the response as a single valid JSON object with this structure:
        {
            "word": {
                "original": "...",
                    "transliteration": "...",
                        "lemma": "...",
                            "strongs": "...",
                                "relatedNoun": {
                    "original": "...",
                        "transliteration": "...",
                            "strongs": "...",
                                "connection": "..."
                },
                "grammar": {
                    "form": "...",
                        "linguisticFunction": "...",
                            "contextualSignificance": "..."
                },
                "definition": "...",
                    "contextualMeaning": "...",
                        "actionFocus": "...",
                            "culturalNuance": "...",
                                "theologicalConnection": "...",
                                    "usageCaution": "...", // WARNING: Only if applicable (Danger List or general caution)
                                        "confidenceTag": "...", // "Clearly Indicates" | "Likely Suggests" | "May Imply"
                                            "counterExample": { // REQUIRED: Negative control
                    "ref": "Verse Ref",
                        "context": "Briefly explain the different/negative usage here"
                }
            },
            "relatedVerses": [
                {
                    "ref": "Book Chapter:Verse",
                    "label": "...",
                    "usage": "..."
                }
            ]
        } `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Log successful API call
        logApiCall('getWordStudy', 'success', 'gemini-2.0-flash', { userId, verseRef });

        // Clean markdown JSON if present
        const jsonStr = text.replace(/```json\n ?|\n ? ```/g, '').trim();
        const data = JSON.parse(jsonStr);

        // Log the question
        await supabase.from('ai_questions').insert({
            user_id: userId,
            question: `Word Study: ${selectedWord || 'General'} in ${verseRef} `,
            answer: text,
            cached: false
        });

        return { success: true, data: data };
    } catch (error) {
        console.error('Word study error:', error);
        logApiCall('getWordStudy', 'error', 'gemini-2.0-flash', { userId, error: error.message });
        return { success: false, error: error.message };
    }
}
