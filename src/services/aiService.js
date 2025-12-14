import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from '../config/supabaseClient';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

// System prompt for biblical accuracy
const SYSTEM_PROMPT = `You are a Bible study assistant. Follow these STRICT rules:

1. Base ALL answers ONLY on the provided Bible verses
2. Cite specific verse references (e.g., John 3:16) for EVERY claim
3. Do NOT add personal interpretation, speculation, or external sources
4. If the provided verses don't fully answer the question, clearly state what IS answered and what ISN'T
5. Format responses clearly with paragraphs and verse citations in parentheses
6. Keep responses biblical, factual, and reverent
7. Maximum 300 words per response

Remember: You are ONLY interpreting what Scripture explicitly states.`;

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
        const verseContext = verses.map(v =>
            `${v.book} ${v.chapter}:${v.verse} - "${v.text}"`
        ).join('\n\n');

        const userPrompt = `${SYSTEM_PROMPT}

**Context Verses:**
${verseContext || 'No specific verses provided'}

**User Question:** ${question}

Provide a biblical answer based on the verses above. Cite specific references.`;

        // 4. Call Gemini AI
        const result = await model.generateContent(userPrompt);
        const response = await result.response;
        const answer = response.text();

        // 5. Save to cache (for reuse)
        await saveCachedAnswer(question, answer);

        // 6. Log the question
        await supabase
            .from('ai_questions')
            .insert({
                user_id: userId,
                question: question,
                answer: answer,
                cached: false,
                verse_context: verseContext
            });

        // 7. Increment API call counter
        await supabase.rpc('increment', {
            table_name: 'ai_quota',
            column_name: 'total_api_calls_today'
        });

        return { success: true, answer, cached: false };

    } catch (error) {
        console.error('AI question error:', error);
        return {
            success: false,
            error: 'Failed to get AI response. Please try again.',
            details: error.message
        };
    }
}
