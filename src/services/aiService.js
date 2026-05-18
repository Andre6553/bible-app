import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from '../config/supabaseClient';
import { logApiCall } from './adminService';
import { logEvent } from './analyticsService';

const AI_PROVIDER = (import.meta.env.VITE_AI_PROVIDER || 'gemini').toLowerCase();
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL || "gemini-2.0-flash";
const GROQ_MODEL = import.meta.env.VITE_GROQ_MODEL || "llama-3.1-8b-instant";

// Initialize Gemini only when configured
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;
const model = genAI ? genAI.getGenerativeModel({ model: GEMINI_MODEL }) : null;

function getModelLabel() {
    if (AI_PROVIDER === 'groq') return GROQ_MODEL;
    return GEMINI_MODEL;
}

async function generateAiText(prompt) {
    // Explicit provider selection with fallback to Gemini if Groq is not configured.
    if (AI_PROVIDER === 'groq') {
        if (!GROQ_API_KEY) {
            throw new Error('Groq API key is missing. Set VITE_GROQ_API_KEY in .env');
        }

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: GROQ_MODEL,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.4
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            // If Groq is temporarily rate-limited, fallback to Gemini when available.
            if ((response.status === 429 || response.status >= 500) && model) {
                console.warn(`Groq unavailable (${response.status}), falling back to Gemini.`);
                const geminiResult = await model.generateContent(prompt);
                const geminiResponse = await geminiResult.response;
                return geminiResponse.text();
            }
            throw new Error(`Groq API error (${response.status}): ${errText}`);
        }

        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content;
        if (!content) {
            throw new Error('Groq API returned an empty response');
        }
        return content;
    }

    if (!model) {
        throw new Error('Gemini API key is missing. Set VITE_GEMINI_API_KEY in .env');
    }

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
}

function extractJsonObject(text) {
    const startIdx = text.indexOf('{');
    const endIdx = text.lastIndexOf('}');
    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
        throw new Error(`AI did not return a valid JSON object. Raw response: ${text.substring(0, 120)}...`);
    }
    return text.substring(startIdx, endIdx + 1);
}

function validateSemanticSearchPayload(data) {
    if (!data || typeof data !== 'object') {
        throw new Error('Invalid semantic payload: not an object');
    }
    if (typeof data.summary !== 'string' || !data.summary.trim()) {
        throw new Error('Invalid semantic payload: missing summary');
    }
    if (!Array.isArray(data.results) || data.results.length === 0) {
        throw new Error('Invalid semantic payload: missing results');
    }

    for (const item of data.results) {
        if (!item || typeof item.ref !== 'string' || typeof item.reason !== 'string') {
            throw new Error('Invalid semantic payload: malformed result item');
        }
    }
}

const HARDWARE_PRODUCT_PATTERN = /\b(creality|cr[-\s]?laser|laser\s+falcon|falcon\s+(?:control\s+)?board)\b/i;
const TECHNICAL_OUT_OF_SCOPE_TERMS = [
    /\bcontrol\s+board\b/i,
    /\bmain\s*board\b/i,
    /\bmotherboard\b/i,
    /\bfirmware\b/i,
    /\bgrbl\b/i,
    /\blaser\s+(?:engraver|cutter|module)\b/i,
    /\bengraver\b/i,
    /\b3d\s*printer\b/i,
    /\bcnc\b/i,
    /\bstepper\s+(?:motor|driver)\b/i,
    /\bmicrocontroller\b/i,
    /\bpcb\b/i
];

function isClearlyOutOfScopeQuestion(question) {
    const normalized = String(question || '').trim();
    if (!normalized) return false;

    if (HARDWARE_PRODUCT_PATTERN.test(normalized)) {
        return true;
    }

    const technicalMatches = TECHNICAL_OUT_OF_SCOPE_TERMS.filter(pattern => pattern.test(normalized)).length;
    return technicalMatches >= 2;
}

function buildOutOfScopeAnswer(question, language) {
    if (language === 'af') {
        return `Die Bybel spreek nie hierdie onderwerp direk aan nie: "${question.trim()}". Omni Bible is bedoel vir Bybelstudie, Skrifgedeeltes, Bybelse temas, woordstudies, preekvoorbereiding en dagstukkies. Vra asseblief 'n Skrifverwante vraag sodat ek met Bybelse verwysings kan help.`;
    }

    return `The Bible does not directly address this topic: "${question.trim()}". Omni Bible is designed for Bible study, passages, biblical themes, word studies, sermon preparation, and devotionals. Please ask a Scripture-related question so I can help with Bible-based support.`;
}

// System prompt for biblical accuracy — every claim must be provable from Scripture
const SYSTEM_PROMPT = `You are a Bible study assistant. Your single most important rule:
EVERY factual or theological claim you make MUST be directly supported by a specific
Bible verse, cited in [[Book Chapter:Verse]] format.

NON-NEGOTIABLE RULES:

1. NEVER fabricate, guess, or invent verse references. Only cite verses that actually
   exist in the canonical Bible (Genesis through Revelation). If you are not 100% sure a
   reference exists and says what you claim, do NOT cite it.

2. Every claim must be provable from Scripture. If you cannot back a statement with a
   real verse, either omit it or clearly flag it as "not directly stated in Scripture"
   or "traditional interpretation, not explicit in the text".

3. Distinguish clearly between:
   - What Scripture EXPLICITLY says (quote/cite the verse).
   - What is INFERRED from Scripture (mark as "implied" and still cite the source verses).
   - Church TRADITION or denominational teaching (mark as "tradition", not Scripture).

4. If a question cannot be answered from the Bible, say so plainly:
   "The Bible does not directly address this." Do NOT speculate, do NOT invent answers,
   and do NOT cite verses that do not truly support the point.

5. If Context Verses are provided in the prompt, prioritize them — quote and cite them
   directly when they answer the question. Only fall back to other passages when the
   provided verses are not relevant.

6. Do not promote one denomination over another. Let Scripture speak for itself in its
   plain, contextual meaning.

7. No speculation about end-time dates, hidden numerical meanings, or things not stated
   in the text. Stay grounded in what is written.

8. Keep responses reverent, factual, pastoral, and under 400 words. Use paragraphs for
   readability.

9. Cite ALL scripture references in EXACTLY this format: [[Book Chapter:Verse]]
   (e.g. [[John 3:16]], [[Genesis 1:1]], [[Romans 8:28]]). NEVER use parentheses
   or any other format for citations — always double square brackets.

10. Aim to include at least 2–3 verse citations per answer when the topic is biblical,
    so the user can verify your claims directly in their Bible.

You answer as a humble, knowledgeable Bible teacher who lets Scripture speak for itself.
Confidence comes from the Word — not from speculation.`;

let aiCacheAccessible = true;

function isPermissionDenied(error) {
    const text = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''} ${error?.code || ''}`.toLowerCase();
    return text.includes('403') || text.includes('forbidden') || text.includes('permission denied') || text.includes('42501');
}

const getCapturedIp = () => {
    try {
        return localStorage.getItem('captured_ip') || null;
    } catch (e) {
        return null;
    }
};

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

        // 1. Check Subscription Status FIRST
        const { data: profile } = await supabase
            .from('user_profiles')
            .select('subscription_tier, subscription_override, subscription_expiry')
            .eq('user_id', userId)
            .single();

        const override = profile?.subscription_override;
        const expiry = profile?.subscription_expiry;
        const isPremium = profile?.subscription_tier === 'premium' ||
            override === 'premium' ||
            override === 'admin' ||
            override === 'tester' ||
            (expiry && new Date(expiry) > new Date());

        // If Premium/Subscriber -> UNLIMITED QUOTA
        if (isPremium) {
            return { remaining: 999999, used: 0, quota: 999999, isPremium: true };
        }

        // 2. Normal Quota Logic for Free Users
        const currentQuota = await getCurrentQuota();

        // Count questions asked today
        const { count, error } = await supabase
            .from('ai_questions')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .gte('created_at', today);

        if (error) throw error;

        const used = count || 0;
        const remaining = Math.max(0, currentQuota - used);

        return { remaining, used, quota: currentQuota, isPremium: false };

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
        if (!aiCacheAccessible) return null;
        const hash = hashQuestion(question);

        const { data, error } = await supabase
            .from('ai_cache')
            .select('*')
            .eq('question_hash', hash)
            .limit(1);

        if (error) {
            if (isPermissionDenied(error)) {
                aiCacheAccessible = false;
                console.warn('ai_cache access denied by RLS. Disabling cache for this session.');
            }
            return null;
        }
        if (!data || data.length === 0) return null;
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
        if (!aiCacheAccessible) return;
        const hash = hashQuestion(question);

        const { error } = await supabase
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

        if (error && isPermissionDenied(error)) {
            aiCacheAccessible = false;
            console.warn('ai_cache write denied by RLS. Disabling cache for this session.');
        }

    } catch (error) {
        console.error('Cache save error:', error);
    }
}

/**
 * Main function: Ask AI a Bible question
 */
export async function askBibleQuestion(userId, question, verses = [], language = 'en', conversationHistory = []) {
    try {
        if (isClearlyOutOfScopeQuestion(question)) {
            return {
                success: true,
                answer: buildOutOfScopeAnswer(question, language),
                cached: false,
                outOfScope: true
            };
        }

        // 1. Check quota
        const { remaining } = await getUserRemainingQuota(userId);
        if (remaining <= 0) {
            return {
                success: false,
                error: 'Daily quota exceeded. Try again tomorrow!',
                quotaExceeded: true
            };
        }

        const isFollowUp = Array.isArray(conversationHistory) && conversationHistory.length > 0;

        // 2. Check cache first - skipped for follow-ups since answers are contextual
        const cacheKey = `${language}:${question}`;
        if (!isFollowUp) {
            const cachedAnswer = await getCachedAnswer(cacheKey);
            if (cachedAnswer) {
                await supabase
                    .from('ai_questions')
                    .insert({
                        user_id: userId,
                        question: question,
                        answer: cachedAnswer,
                        cached: true,
                        ip_address: getCapturedIp()
                    });

                return { success: true, answer: cachedAnswer, cached: true };
            }
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

        if (isFollowUp) {
            userPrompt += "**Previous Conversation (continue this thread; the user is now asking a follow-up about the answer below):**\n";
            conversationHistory.forEach(turn => {
                const speaker = turn.role === 'user' ? 'User' : 'Assistant';
                const cleanContent = String(turn.content || '').trim();
                userPrompt += `${speaker}: ${cleanContent}\n\n`;
            });
            userPrompt += "**User's Follow-up Question:** " + question + "\n\n";
            userPrompt += `Provide a biblical answer in ${langOutput} that directly continues the conversation above.\n`;
            userPrompt += "1. Treat this as a follow-up: reference and build on what was said earlier when relevant.\n";
            userPrompt += "2. Every new claim in this follow-up MUST still be backed by a real [[Book Chapter:Verse]] citation — do not repeat unverified points from earlier turns without Scripture support.\n";
            userPrompt += "3. PRIORITIZE using the Context Verses above if they are relevant; only use other passages when needed.\n";
            userPrompt += "4. CRITICAL: Cite verses only in [[Book Chapter:Verse]] format. Never invent references.\n";
            userPrompt += "5. If you cannot find a direct biblical answer, say \"The Bible does not directly address this\" — do not speculate.\n";
        } else {
            userPrompt += "**User Question:** " + question + "\n\n";
            userPrompt += `Provide a biblical answer in ${langOutput}.\n`;
            userPrompt += "1. PRIORITIZE using the Context Verses above if they are relevant; quote and cite them when they answer the question.\n";
            userPrompt += "2. Every factual or theological claim MUST be supported by at least one real [[Book Chapter:Verse]] citation.\n";
            userPrompt += "3. CRITICAL: Cite verses only in [[Book Chapter:Verse]] format. Never invent or guess references.\n";
            userPrompt += "4. If you cannot find a direct biblical answer, say \"The Bible does not directly address this\" — do not speculate.\n";
        }

        // 4. Call Gemini AI
        const answer = await generateAiText(userPrompt);

        // Log successful API call
        logApiCall('askBibleQuestion', 'success', getModelLabel(), { userId, provider: AI_PROVIDER });

        // 5. Save to cache (for reuse) - Non-blocking. Skip for follow-ups (contextual answers).
        if (!isFollowUp) {
            saveCachedAnswer(cacheKey, answer).catch(console.error);
        }

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
                    device_info: navigator.userAgent,
                    ip_address: getCapturedIp()
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
        logApiCall('askBibleQuestion', 'error', getModelLabel(), { userId, provider: AI_PROVIDER, error: error.message });

        // More specific error messages
        let errorMessage = 'Failed to get AI response. Please try again.';

        const errMsg = error.message?.toLowerCase() || '';

        if (errMsg.includes('quota') || errMsg.includes('limit') || errMsg.includes('rate') || errMsg.includes('429')) {
            errorMessage = 'AI rate limit reached. Please wait a minute and try again.';
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

        let data = null;
        let lastError = null;
        let lastRawText = '';

        // Retry/repair loop for strict JSON compliance.
        for (let attempt = 0; attempt < 3; attempt++) {
            const attemptPrompt = attempt === 0 ? prompt : `
Your previous output was invalid.
Return ONLY valid JSON with this exact structure:
{
  "hints": {
    "who": "...", "what": "...", "where": "...", "keywords": ["...", "..."], "commands": "...", "promises": "...",
    "author": "...", "context": "...", "meaning": "...", "crossRefs": "...",
    "god": "...", "myself": "...", "change": "...", "action": "..."
  }
}
No markdown, no explanation, no extra text before or after JSON.

Original task:
${prompt}

Previous invalid output:
${lastRawText}
`;

            try {
                const text = await generateAiText(attemptPrompt);
                lastRawText = text;
                const jsonStr = extractJsonObject(text.replace(/```json\n?|\n?```/g, '').trim());
                const parsed = JSON.parse(jsonStr);
                if (!parsed || typeof parsed !== 'object' || !parsed.hints || typeof parsed.hints !== 'object') {
                    throw new Error('Invalid hints payload: missing hints object');
                }
                data = parsed;
                break;
            } catch (err) {
                lastError = err;
            }
        }

        if (!data) {
            throw new Error(`Study hints format validation failed after retries: ${lastError?.message || 'unknown error'}`);
        }

        // Log successful API call
        logApiCall('getInductiveStudyHints', 'success', getModelLabel(), { userId, provider: AI_PROVIDER, step, ref });

        // Map data back to log
        await supabase.from('ai_questions').insert({
            user_id: userId,
            question: `Inductive Hint Step ${step} for ${ref}`,
            answer: JSON.stringify(data),
            cached: false,
            ip_address: getCapturedIp()
        });

        return { success: true, hints: data.hints };
    } catch (error) {
        console.error('Study hints error:', error);
        logApiCall('getInductiveStudyHints', 'error', getModelLabel(), { userId, provider: AI_PROVIDER, error: error.message });
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

        const text = await generateAiText(prompt);

        // Log successful API call
        logApiCall('getWordStudy', 'success', getModelLabel(), { userId, provider: AI_PROVIDER, verseRef });

        // Clean markdown JSON if present
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : text;
        const data = JSON.parse(jsonStr);

        // Log the question
        await supabase.from('ai_questions').insert({
            user_id: userId,
            question: `Word Study: ${selectedWord || 'General'} in ${verseRef}`,
            answer: text,
            cached: false,
            ip_address: getCapturedIp()
        });

        return { success: true, data: data };
    } catch (error) {
        console.error('Word study error:', error);
        logApiCall('getWordStudy', 'error', getModelLabel(), { userId, provider: AI_PROVIDER, error: error.message });
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

        const text = await generateAiText(prompt);

        // Log successful API call
        logApiCall('getChapterSummary', 'success', getModelLabel(), { userId, provider: AI_PROVIDER, ref });

        // Clean markdown JSON if present
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : text;
        const data = JSON.parse(jsonStr);

        // Log to ai_questions for history/visibility
        await supabase.from('ai_questions').insert({
            user_id: userId,
            question: `Chapter Summary: ${ref}`,
            answer: text,
            cached: false,
            ip_address: getCapturedIp()
        });

        return { success: true, data };
    } catch (error) {
        console.error('Chapter summary error:', error);
        logApiCall('getChapterSummary', 'error', getModelLabel(), { userId, provider: AI_PROVIDER, error: error.message });
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

        let data = null;
        let lastError = null;
        let lastRawText = '';

        // Retry/repair loop for stricter JSON compliance across providers.
        for (let attempt = 0; attempt < 3; attempt++) {
            const attemptPrompt = attempt === 0 ? prompt : `
Your previous output was invalid for this strict JSON contract.
Return ONLY valid JSON with this exact structure:
{
  "summary": "string",
  "results": [
    { "ref": "Book Chapter:Verse", "reason": "string" }
  ]
}
Do not include markdown fences, explanations, or extra keys.

Original task:
${prompt}

Previous invalid output:
${lastRawText}
`;

            try {
                const text = (await generateAiText(attemptPrompt)).trim();
                lastRawText = text;
                const jsonStr = extractJsonObject(text);
                const parsed = JSON.parse(jsonStr);
                validateSemanticSearchPayload(parsed);
                data = parsed;
                break;
            } catch (err) {
                lastError = err;
            }
        }

        if (!data) {
            throw new Error(`Semantic search format validation failed after retries: ${lastError?.message || 'unknown error'}`);
        }

        // 2. Save to Cache
        saveCachedAnswer(cacheKey, JSON.stringify(data)).catch(console.error);

        // 3. Log to questions (async)
        try {
            supabase.from('ai_questions').insert({
                user_id: userId,
                question: `Semantic Search: ${query}`,
                answer: `Summary: ${data.summary || 'N/A'}. Found ${data.results?.length || 0} verses.`,
                cached: false,
                ip_address: getCapturedIp()
            }).then(({ error }) => {
                if (error) console.warn('Background logging failed', error);
            });
        } catch (e) {
            console.warn('Logging triggered error', e);
        }

        // [NEW] Log API Usage for Admin Dashboard
        logApiCall('performSemanticSearch', 'success', getModelLabel(), { userId, provider: AI_PROVIDER, query, results: data.results?.length });

        return { success: true, data, cached: false };

    } catch (error) {
        console.error('Semantic search error:', error);
        logApiCall('performSemanticSearch', 'error', getModelLabel(), { userId, provider: AI_PROVIDER, query, error: error.message });
        return { success: false, error: error.message };
    }
}


/**
 * Fetch AI question history for a user from Supabase
 */
export async function getAIHistory(userId) {
    try {
        if (!userId) return [];

        const { data, error } = await supabase
            .from('ai_questions')
            .select('question, answer, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;

        return data.map(item => ({
            question: item.question,
            answer: item.answer,
            timestamp: item.created_at
        }));
    } catch (error) {
        console.error('Fetch AI history error:', error);
        return [];
    }
}
