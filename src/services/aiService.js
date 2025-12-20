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

        let prompt = `You are a Biblical language scholar (Greek and Hebrew). Analyze the following:
        
        CRITICAL INSTRUCTION: You MUST provide the explanation, definitions, and cultural nuances in ${language === 'af' ? 'AFRIKAANS' : 'ENGLISH'}.
        
        Verse Reference: ${verseRef}
        Translation Text: "${verseText}"
        Original Language Text: "${originalText}"
        ${selectedWord ? `Target Word to Study: "${selectedWord}"` : 'General Verse Analysis (Original Languages focus)'}

        Provide a deep dive into the original Greek or Hebrew word(s). 
        
        Rules:
        1. Identify the correct original word (lemma) even if the grammar in the verse is inflected.
        2. Provide accurate transliteration.
        3. Explain the specific contextual nuance of this word in THIS verse.
        4. Include cultural or historical background if relevant.

        Format the response as a single valid JSON object with this structure:
        {
            "word": {
                "original": "...", // The word in Greek/Hebrew characters
                "transliteration": "...", // Phonetic 
                "lemma": "...", // Lexical root
                "strongs": "...", // Strong's number (prefix G or H)
                "definition": "...", // Concise dictionary meaning
                "contextualMeaning": "...", // Usage in this specific verse context
                "culturalNuance": "..." // Historical/theological significance
            },
            "relatedVerses": [
                {
                    "ref": "Book Chapter:Verse", // Standard English reference for system lookup
                    "label": "..." // Localized reference for display (e.g. "Johannes 3:16")
                }
            ] // 2-3 other verses using this same root meaningfully
        }`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Log successful API call
        logApiCall('getWordStudy', 'success', 'gemini-2.0-flash', { userId, verseRef });

        // Clean markdown JSON if present
        const jsonStr = text.replace(/```json\n?|\n?```/g, '').trim();
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
