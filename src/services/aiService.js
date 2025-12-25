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
            .limit(1);

        if (error || !data || data.length === 0) return null;
        const entry = data[0];

        // Update hit count (background)
        supabase
            .from('ai_cache')
            .update({
                hit_count: entry.hit_count + 1,
                updated_at: new Date().toISOString()
            })
            .eq('id', entry.id)
            .then(({ error }) => {
                if (error) console.warn('Cache hit update failed', error);
            });

        return entry.answer;

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
export async function askBibleQuestion(userId, question, verses = [], language = 'en') {
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

        // 2. Check cache first - Cache key should include language to avoid cross-language leakage
        const cacheKey = `${language}:${question}`;
        const cachedAnswer = await getCachedAnswer(cacheKey);
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

        const isAf = language === 'af';
        const langOutput = isAf ? 'Afrikaans' : 'English';

        let userPrompt = SYSTEM_PROMPT + "\n\n";
        userPrompt += `CRITICAL: You MUST provide your entire response in ${langOutput}.\n`;
        if (isAf) {
            userPrompt += "SKRYF IN AFRIKAANS. Gebruik die 1983-vertaling (AFR83) of 1953-vertaling (AFR53) vir aanhalings indien moontlik.\n";
        }
        userPrompt += "\n";
        userPrompt += "**Context Verses (Reference Only):**\n";
        userPrompt += contextText + "\n\n";
        userPrompt += "**User Question:** " + question + "\n\n";
        userPrompt += `Provide a biblical answer in ${langOutput}.\n`;
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
        saveCachedAnswer(cacheKey, answer).catch(console.error);

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

        let prompt = `Generate biblical word studies by first identifying grammatical form, then determining meaning strictly from immediate context and authorial usage, before consulting lexical ranges. Avoid absolute definitions, prevent grammar-based theological claims, and ensure interpretations could withstand academic scrutiny.

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
        HEBREW/ARAMAIC SPECIFIC REFINEMENTS (Apply when analyzing Hebrew/OT texts):
        
        1. LEMMA & RELATED FORMS
           - Always identify the lemma (dictionary form).
           - List related nouns/verbs ONLY if direct derivational/contextual relationship exists.
           - If no related form exists, explicitly write "None".

        2. GRAMMAR (Function over Causation)
           - Identify Part of Speech, Number, Gender (if relevant), Case/Construct.
           - Explain grammatical role (subject, object, modifier).
           - Avoid implying causation from grammar.
           - Emphasize function in context (e.g., divine perception, object of favor).

        3. CONTEXTUAL MEANING
           - Describe meaning in immediate verse context.
           - Focus on literal, idiomatic, or relational meaning.
           - Avoid importing later theological doctrines unless explicit in context.

        4. WHAT THIS WORD DOES (Functional Role)
           - Explain function: what it expresses, emphasizes, or denotes.
           - Focus on perspective or effect (e.g., Noah as recipient, God as source).
           - Avoid causal or merit-based statements unless explicit.

        5. CULTURAL & HISTORICAL NUANCE
           - Explain idioms (e.g., "find favor"), metaphors, or historical usage.
           - Clarify original audience understanding.
 
        6. NEGATIVE CONTROL / COUNTEREXAMPLE
           - Include at least one example where word is used differently.
           - Show how meaning shifts in other contexts (e.g., חֵן as charm vs favor).
 
        7. THEOLOGICAL CONNECTION (Neutrality)
           - Connect carefully to narrative/themes without assuming causation/merit.
           - Use phrasing: "Introduces the theme of...", "Prefigures...".
           - Avoid projecting later Christian doctrine unless explicitly in context.

        REQUIRED: Include at least one qualifying phrase per section: "In this context...", "As used here...", or "Within this passage..."

        REQUIRED: Include at least one qualifying phrase per section: "In this context...", "As used here...", or "Within this passage..."

        CRITICAL INSTRUCTION - LANGUAGE ENFORCEMENT:
        - Output MUST be 100% in ${language === 'af' ? 'AFRIKAANS' : 'ENGLISH'}.
        - Translate ALL explanations, labels, headers, and descriptions.
        - Do NOT mix English into Afrikaans output (except for necessary theological terms like 'Lemma').

        CRITICAL INSTRUCTION - SCRIPTURE CITATIONS:
        - "relatedVerses" -> "ref" MUST use STANDARD ENGLISH BOOK NAMES (e.g., "Genesis 6:8", "John 3:16") even if the output language is Afrikaans. This is required for the app's navigation system.
        - "relatedVerses" -> "label" CAN and SHOULD be in the target language (e.g., "Johannes 3:16").
        - Do NOT use titles like "Lineage of Levi" in the "ref" field. Use the "label" field for titles.
        - If the AI puts a title in "ref", the system is broken.

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
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : text;
        const data = JSON.parse(jsonStr);

        // Log the question
        await supabase.from('ai_questions').insert({
            user_id: userId,
            question: `Word Study: ${selectedWord || 'General'} in ${verseRef}`,
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

/**
 * Generate a concise summary and structured outline for a Bible chapter
 */
export async function getChapterSummary(userId, bookName, chapter, verses = [], language = 'en') {
    try {
        const { remaining } = await getUserRemainingQuota(userId);
        if (remaining <= 0) return { success: false, error: 'Daily quota exceeded. Try again tomorrow!' };

        const ref = `${bookName} ${chapter}`;
        const contextText = verses.length > 0
            ? verses.map(v => `${v.verse}: ${v.text}`).join('\n')
            : 'No verse text provided';

        const outputLanguage = language === 'af' ? 'Afrikaans' : 'English';

        let prompt = `You are a Bible scholar. Generate a concise summary and a structured outline for ${ref}.
        
        The output MUST be 100% in ${outputLanguage}.
        
        **Chapter Text Context:**
        ${contextText}
        
        **Requirements:**
        1. **Summary:** A single, powerful paragraph (max 100 words) capturing the main message and theme of the chapter.
        2. **Outline:** A structured list of the chapter's sections, including verse ranges and brief titles (e.g., "1-10: The Creation of Light").
        
        Format the response as a valid JSON object with this structure:
        {
            "summary": "...",
            "outline": [
                { "range": "1-10", "title": "..." },
                { "range": "11-20", "title": "..." }
            ]
        }`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Log successful API call
        logApiCall('getChapterSummary', 'success', 'gemini-2.0-flash', { userId, ref });

        // Clean markdown JSON if present
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : text;
        const data = JSON.parse(jsonStr);

        // Log to ai_questions for history/visibility
        await supabase.from('ai_questions').insert({
            user_id: userId,
            question: `Chapter Summary: ${ref}`,
            answer: text,
            cached: false
        });

        return { success: true, data };
    } catch (error) {
        console.error('Chapter summary error:', error);
        logApiCall('getChapterSummary', 'error', 'gemini-2.0-flash', { userId, error: error.message });
        return { success: false, error: error.message };
    }
}


/**
 * Perform Semantic (Concept-based) Bible Search
 * Returns a list of Bible references and explanations for a given concept/query
 */
export async function performSemanticSearch(userId, query, versionId = 'KJV', testament = 'all', language = 'en') {
    try {
        const { remaining } = await getUserRemainingQuota(userId);
        if (remaining <= 0) return { success: false, error: 'Daily quota exceeded. Try again tomorrow!' };

        // 1. Check Cache
        const cacheKey = `semantic_${query.toLowerCase().trim()}_${language}`;
        const cached = await getCachedAnswer(cacheKey);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                return { success: true, data: parsed, cached: true };
            } catch (e) {
                console.warn("Malformed semantic cache entry", e);
            }
        }

        const outputLanguage = language === 'af' ? 'Afrikaans' : 'English';
        const testamentLimit = testament === 'OT' ? 'limit search to the Old Testament' :
            testament === 'NT' ? 'limit search to the New Testament' :
                'consider both Old and New Testaments';

        const prompt = `You are a Bible search assistant. A user is looking for Bible verses based on a concept, feeling, or situation: "${query}".
        
        **CRITICAL INSTRUCTION**: All output (summary and reasons) MUST be in **${outputLanguage}**. Do not use any English if the requested language is Afrikaans.
        
        **Instructions:**
        1. **Biblical Summary**: Provide a 2-3 sentence biblical reflection or summary addressing the user's situation directly. This MUST be based strictly on biblical principles and facts that can be proven with verses.
        2. **Relevant Verses**: Find 5-8 Bible verses that are most relevant to this conceptual query and support your summary.
        3. ${testamentLimit}.
        4. For each verse, provide:
           - The exact Bible reference (e.g., "John 3:16").
           - A very brief (1-2 sentences) "Semantic Reason" in **${outputLanguage}** explaining why this verse is relevant.
        
        **Format:**
        Return ONLY a JSON object with this structure:
        {
          "summary": "Your biblical reflection in ${outputLanguage} here...",
          "results": [
            { "ref": "Book Chapter:Verse", "reason": "..." },
            ...
          ]
        }
        
        Do not include markdown formatting like \`\`\`json. Just the raw JSON object.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text().trim();

        // Robust JSON extraction: Find the first { and last }
        const startIdx = text.indexOf('{');
        const endIdx = text.lastIndexOf('}');

        if (startIdx === -1 || endIdx === -1) {
            throw new Error(`AI did not return a valid JSON object. Raw response: ${text.substring(0, 100)}...`);
        }

        const jsonStr = text.substring(startIdx, endIdx + 1);
        const data = JSON.parse(jsonStr);

        // 2. Save to Cache
        saveCachedAnswer(cacheKey, JSON.stringify(data)).catch(console.error);

        // 3. Log to questions (async)
        try {
            supabase.from('ai_questions').insert({
                user_id: userId,
                question: `Semantic Search: ${query}`,
                answer: `Summary: ${data.summary || 'N/A'}. Found ${data.results?.length || 0} verses.`,
                cached: false
            }).then(({ error }) => {
                if (error) console.warn('Background logging failed', error);
            });
        } catch (e) {
            console.warn('Logging triggered error', e);
        }

        return { success: true, data, cached: false };

    } catch (error) {
        console.error('Semantic search error:', error);
        logApiCall('performSemanticSearch', 'error', 'gemini-2.0-flash', { userId, query, error: error.message });
        return { success: false, error: error.message };
    }
}
