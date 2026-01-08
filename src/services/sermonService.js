import { supabase } from '../config/supabaseClient';
import { getUserId } from './bibleService';
import { logApiCall } from './adminService';

/**
 * SERMON SERVICE
 * Handles CRUD for sermons and AI Generation for Exegesis/Structure
 */

// ==========================================
// ==========================================
// CRUD OPERATIONS
// ==========================================

const checkTesterRenewal = async (userId, profile) => {
    // Only for tesers
    const override = profile?.subscription_override;
    if (override !== 'tester') return false;

    const currentRef = new Date().toISOString().slice(0, 7); // "2024-01"
    const lastRenewal = profile?.last_renewal_month;

    if (lastRenewal !== currentRef) {
        // Reset DB Counters - Server Side
        console.log('🔄 Tester Monthly Renewal Triggered for', currentRef);
        await supabase.from('user_profiles').update({
            sermon_trial_count: 0,
            ai_usage_count: 0,
            last_renewal_month: currentRef,
            last_seen: new Date().toISOString()
        }).eq('user_id', userId);

        return true; // Reset happened
    }
    return false;
};






export const getMySermons = async () => {
    try {
        const userId = await getUserId();
        if (!userId) return { success: false, error: 'User not logged in' };

        const { data, error } = await supabase
            .from('sermons')
            .select('*')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false });

        if (error) throw error;
        return { success: true, sermons: data || [] };
    } catch (err) {
        console.error('Error fetching sermons:', err);
        return { success: false, error: err.message };
    }
};

export const createSermon = async (sermonData, fingerprint) => {
    try {
        const userId = await getUserId();
        if (!userId) return { success: false, error: 'User not logged in' };

        // 1. Fetch Profile to check trials/tier
        const { data: profile, error: pError } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (pError && pError.code !== 'PGRST116') throw pError;

        // Check for tester renewal (DB based)
        const resetHappened = await checkTesterRenewal(userId, profile);

        const tier = profile?.subscription_tier || 'free';
        // If reset happened, we treat trials as 0 for this checking purpose
        const trials = resetHappened ? 0 : (profile?.sermon_trial_count || 0);

        // 2. Anti-Abuse: Check if this device has already exhausted trials on other accounts
        if (tier === 'free' && fingerprint) {
            const { data: fingerprintMatches, error: fError } = await supabase
                .from('user_profiles')
                .select('user_id, sermon_trial_count')
                .eq('device_fingerprint', fingerprint)
                .neq('user_id', userId) // Other accounts
                .gte('sermon_trial_count', 3);

            if (fError) console.error('Fingerprint check error:', fError);

            if (fingerprintMatches && fingerprintMatches.length > 0) {
                console.warn('🚩 Anti-Abuse: Device blocked (Trials exhausted on another account)');
                return { success: false, error: 'TRIAL_EXPIRED' };
            }
        }

        // 3. Check Trial Limit for current account & Overrides
        const override = profile?.subscription_override;
        let limit = 3;
        if (override === 'tester') limit = 10;
        if (override === 'admin') limit = 9999;

        // If admin, we can skip the check entirely, or just set high limit.
        // If tester, we check against 10.
        // If normal free, we check against 3.

        if (tier === 'free' && override !== 'admin') {
            if (trials >= limit) {
                return { success: false, error: 'TRIAL_EXPIRED' };
            }
        }

        // 4. Create Sermon
        const { data, error } = await supabase
            .from('sermons')
            .insert({
                user_id: userId,
                title: sermonData.title,
                main_scripture: sermonData.mainScripture,
                audience: sermonData.audience,
                tone: sermonData.tone || 'balanced',
                theme: sermonData.theme,
                planned_duration: sermonData.plannedDuration || 90,
                step: 'skeleton',
                blocks: sermonData.blocks || []
            })
            .select()
            .single();

        if (error) throw error;

        // 4. Increment Trial Count & Save Fingerprint (Background)
        // Only increment if we are technically still "free" in database, 
        // regardless of override, so we track usage.
        if (tier === 'free') {
            supabase.from('user_profiles').upsert({
                user_id: userId,
                sermon_trial_count: trials + 1,
                device_fingerprint: fingerprint,
                last_seen: new Date().toISOString()
            }, { onConflict: 'user_id' }).then(({ error: uError }) => {
                if (uError) console.error('Error updating trial count:', uError);
            });
        }

        return { success: true, sermon: data };
    } catch (err) {
        console.error('Error creating sermon:', err);
        return { success: false, error: err.message };
    }
};

export const updateSermon = async (id, updates) => {
    try {
        const { data, error } = await supabase
            .from('sermons')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return { success: true, sermon: data };
    } catch (err) {
        console.error('Error updating sermon:', err);
        return { success: false, error: err.message };
    }
};

export const deleteSermon = async (id) => {
    try {
        const { error } = await supabase
            .from('sermons')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return { success: true };
    } catch (err) {
        console.error('Error deleting sermon:', err);
        return { success: false, error: err.message };
    }
};

// ==========================================
// AI GENERATION & LIMITS
// ==========================================

const checkAndIncrementAiUsage = async () => {
    const userId = await getUserId();
    if (!userId) throw new Error('User not logged in');

    // 1. Fetch Profile
    const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error) throw error;

    // Check for tester renewal (DB based)
    const resetHappened = await checkTesterRenewal(userId, profile);

    const tier = profile?.subscription_tier || 'free';
    // If reset happened, usage is effectively 0 locally for the check (though DB is 0 already)
    // But since we selected *before* the reset, 'profile.ai_usage_count' is OLD.
    const currentUsage = resetHappened ? 0 : (profile?.ai_usage_count || 0);

    const override = profile?.subscription_override;
    const expiry = profile?.subscription_expiry;
    const isPremium = override === 'premium' ||
        override === 'admin' ||
        override === 'tester' ||
        (expiry && new Date(expiry) > new Date());

    // 2. Enforce Limit
    let limit = 50;
    if (isPremium) limit = 999999; // Premium/Admin/Tester/Valid Subscription
    if (override === 'tester') limit = 500; // Specific tester limit if needed, but isPremium covers it. keeping logic simple.

    // Refined Logic:
    // If Admin -> Unlimited (covered by isPremium)
    // If Tester -> 500 (covered by isPremium setting high, or specific check)
    // If Premium Sub -> Unlimited
    // If Free/Expired -> 50

    if (override === 'tester') limit = 500; // Explicit tester limit constraint
    if (!isPremium && override !== 'admin') {
        if (currentUsage >= limit) {
            throw new Error('AI_LIMIT_EXCEEDED');
        }
    }

    // 3. Increment Count
    await supabase.from('user_profiles').update({
        ai_usage_count: currentUsage + 1,
        last_seen: new Date().toISOString()
    }).eq('user_id', userId);

    return true;
};

export const generateExegesis = async (scripture, title, audience, theme, language = 'en', plannedDuration = 90, tone) => {
    try {
        await checkAndIncrementAiUsage(); // Enforce Limit

        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const isAf = language === 'af';
        const langInstruction = isAf
            ? 'Output MUST be in Afrikaans.'
            : 'Output MUST be in English.';

        const prompt = `
        Act as a professional biblical scholar and homiletics expert.
        I am preparing a sermon with the following details:
        - Title: "${title}"
        - Main Scripture(s): "${scripture}" (If multiple passages are listed, synthesize them)
        - Target Audience: "${audience}"
        - Style/Tone: "${tone || 'balanced'}"
        - Central Theme: "${theme || 'N/A'}"
        - Planned Duration: ${plannedDuration} minutes
        
        Please provide a "Structural Skeleton" for a ${plannedDuration}-minute sermon (or deep study) on this text.
        Tailor the tone of the suggested blocks (titles and types) to the Style/Tone provided ("${tone || 'balanced'}").
        
        CRITICAL STRUCTURE INSTRUCTIONS:
        - If Planned Duration is < 10 mins: Generate ONLY 3 blocks: Introduction, 1 Main Body Point, and Conclusion. Keep it simple.
        - If Planned Duration is 10-20 mins: Generate Intro, 2-3 Main Points, and Conclusion.
        - If Planned Duration is > 20 mins: Use a full breakdown (Intro, 3-5 Points, Application, Conclusion).
        
        Return a JSON object with this EXACT structure:
        {
            "exegesis": {
                "context": "Brief historical/cultural context...",
                "keywords": [
                    {"word": "OriginalWord", "meaning": "Deep meaning..."}
                ]
            },
            "suggested_blocks": [
                {
                    "type": "intro",
                    "title": "Introduction", 
                    "duration": 2, 
                    "notes": "Hook the audience..."
                },
                ... (fill time to approximately ${plannedDuration} mins) ...
            ]
        }
        
        ${langInstruction}
        RETURN ONLY RAW JSON. NO MARKDOWN.
        `;

        const result = await model.generateContent(prompt);
        const text = result.response.text();

        // Clean markdown if present
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(jsonStr);

        logApiCall('generateExegesis', 'success', 'gemini-2.0-flash', { scripture });
        return { success: true, data };

    } catch (err) {
        console.error('Error generating exegesis:', err);
        logApiCall('generateExegesis', 'error', 'gemini-2.0-flash', { error: err.message });
        return { success: false, error: 'Could not analyze scripture.' };
    }
};

// ==========================================
// AI RESEARCH TOOLS
// ==========================================

export const performResearch = async (tool, query, context, language = 'en') => {
    try {
        await checkAndIncrementAiUsage(); // Enforce Limit

        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const isAf = language === 'af';
        const langInstruction = isAf
            ? 'Response MUST be in Afrikaans.'
            : 'Response MUST be in English.';

        let prompt = '';
        let generationConfig = {};

        switch (tool) {
            case 'word_study':
                prompt = `Perform a biblical word study on "${query}".
                Context: ${context}.
                1. Identify the original Greek/Hebrew word.
                2. Give the phonetic pronunciation.
                3. Explain the root meaning and usage in this context.
                ${langInstruction}`;
                break;
            case 'history':
                prompt = `Provide historical and cultural context for: "${query}".
                Context: ${context}.
                Explain user-relevant customs, politics, or geography of that time.
                ${langInstruction}`;
                break;
            case 'commentary':
                prompt = `Summarize what classic theologians (e.g., Matthew Henry, Spurgeon, Calvin) say about: "${query}".
                Context: ${context}.
                Keep it concise (under 150 words).
                ${langInstruction}`;
                break;
            case 'illustration':
                prompt = `Suggest a compelling, modern illustration or story to explain: "${query}".
                Context: ${context}.
                Target Audience: ${context.split('Audience: ')[1] || 'General'}.
                ${langInstruction}`;
                break;
            case 'cross_ref':
                prompt = `List 3-5 relevant cross-references for: "${query}".
                Context: ${context}.
                Briefly explain the connection for each.
                ${langInstruction}`;
                break;
            case 'bible_verse':
                prompt = `Find Bible verses related to: "${query}".
                Context: ${context}.
                
                CRITICAL FORMAT:
                1. START your response with a clean list of verse references ONLY (e.g. "📖 John 3:16, Romans 8:28, Psalm 23:1").
                2. Then add a blank line.
                3. Then provide brief context or explanation for each verse.
                
                Example format:
                📖 John 3:16, Romans 8:28, Psalm 23:1-4
                
                - John 3:16: God's love for the world...
                - Romans 8:28: All things work together...
                
                ${langInstruction}`;
                break;
            case 'suggest_content':
                const isIntro = context.includes('Introduction');
                const minutes = parseInt(context.match(/(\d+) mins?/)?.[1] || '5');
                const maxWords = minutes * 135; // Absolute ceiling
                const targetWordCount = minutes * 120; // Ideal target

                prompt = `Generate the SPOKEN notes for the following sermon block: "${query}".
                Context: ${context}.

                🛑 STRICT LENGTH CONSTRAINT (PRIORITY #1):
                - TARGET WORD COUNT: ~${targetWordCount} words.
                - ABSOLUTE MAXIMUM: ${maxWords} words.
                - You MUST STOP before reaching ${maxWords} words.
                - Generating 1000+ words for a 5-minute block is a CRITICAL FAILURE. Keep it tight.

                CRITICAL INSTRUCTIONS:
                1. ${isIntro ? 'This is the introduction. Include a warm greeting and hook.' : 'DO NOT include any greetings, welcomes, or "Hello everyone". Start immediately with the core message of this point.'}
                2. You MUST include at least one specific Bible verse quoted in full.
                3. You MUST include a distinct section for "MODERN APPLICATION" or "LIFE APPLICATION" where you explain how this scripture applies to daily life today.
                4. COMPLETENESS & PACING:
                   - You MUST provide a complete, finished section. Do not end mid-thought.
                   - Manage your word budget: Don't spend 80% on the intro. Get to the point.
                   - If you are nearing the limit, WRAP UP immediately.
                5. ACCURACY RULE: Do NOT count headers or metadata. Focus on the actual spoken script. Verifieer jou woordtelling self voordat jy stop.
                6. AUDIENCE & TONE: Tailor the script to the AUDIENCE AND the Style/Tone provided.
                7. TONE OVERRIDE: Prioritize the selected mood (e.g., High Energy, Compassionate).
                
                FORMATTING RULES:
                1. Directions/Actions (not spoken) must be in parentheses. Example: (Pause for effect), (Hold up Bible).
                2. Direct Scripture Quotes must be contained in double quotes. Example: "For God so loved the world..."
                
                Structure your response exactly like this:
                
                **Objective:** [A 1-sentence description of what this section achieves]
                
                [Full text content...]
                
                **Modern Application:**
                [How this applies to our lives today...]
                
                ${langInstruction}`;
                // Dynamic Token Limit: ~1.5 tokens per word + buffer
                // 5 mins = 600 words = ~900 tokens. Cap at 1500 to be safe but prevent 2000+ words.
                // UPDATED: Use 2.5x buffer to prevent mid-sentence cutoffs, relying on prompt for brevity.
                const estimatedTokens = Math.ceil(maxWords * 2.5);
                generationConfig = {
                    maxOutputTokens: Math.min(estimatedTokens, 8192), // Use dynamic limit, but never exceed model max
                };
                break;
            case 'polish_all':
                generationConfig = {
                    responseMimeType: "application/json",
                    maxOutputTokens: 8192
                };
                prompt = `Act as a Homiletics Expert and Sermon Auditor. 
                
                Analyze every point and provide specific adjustment suggestions to:
                1. Improve the flow and transitions between points.
                2. Remove redundant greetings (keep greetings ONLY in the introduction).
                3. Ensure every point has at least one Bible verse quoted in full.
                4. Enhance the "MODERN APPLICATION" section to ensure it's practical for today's living.
                5. Ensure that all changes and suggestions are Biblically correct and aligned with scriptural truth.
                
                Sermon Outline & Notes:
                ${query}
                
                Return a JSON object with this EXACT structure:
                {
                    "rating": 85, // A numerical rating of the current sermon quality (0-100)
                    "analysis": "Brief overall critique (1-2 sentences).",
                    "suggestions": [
                        {
                            "index": 0, 
                            "suggested": "The full revised text for the block including scripture and application. Preserve formatting.",
                            "reason": "Explain briefly why these changes make the sermon better."
                        }
                    ]
                }

                CRITICAL RULES:
                1. YOUR ENTIRE RESPONSE MUST BE A VALID JSON OBJECT.
                2. ESCAPE ALL INTERNAL DOUBLE QUOTES with a backslash. Example: if the text is 'He said "Hello"', it must be written in the JSON as "He said \"Hello\"".
                3. DO NOT USE LITERAL NEWLINES within string values; use \\n instead.
                4. CONCISENESS: If the sermon is very long, focus on the most impactful suggestions.
                5. START YOUR RESPONSE WITH '{' AND END WITH '}'.
                6. ZERO TOLERANCE: Any unescaped double quotes inside a string value will cause a system failure.
                7. STRICT TIME ADHERENCE: 
                   - ONLY SHORTEN if the text significantly EXCEEDS the Time Budget (roughly > +10% target words).
                   - If the text is UNDER or NEAR the target, maintain the length. Focus on quality, flow, and impact.
                   - Do NOT cut content just for the sake of brevity if it fits the time.
                8. FORMATTING PRESERVATION: 
                   - KEEP ALL INSTRUCTIONAL TEXT in parentheses (e.g., "(Pause for effect)") EXACTLY as they are. These are rendered in RED.
                   - KEEP ALL SCRIPTURE QUOTES in double quotes (e.g., "For God so loved the world...") EXACTLY as they are. These are rendered in BLUE.
                   - Do NOT change the punctuation or structure of these elements.
                9. CRITICAL JSON RULE: DO NOT escape single quotes. Write "God's", NOT "God\'s".
                
                The goal is to refine the sermon while maintaining its original length and special formatting.
                ${langInstruction}`;
                break;
            default:
                prompt = `Research: ${query}. ${langInstruction}`;
        }

        const chatModel = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash',
            generationConfig
        });

        const result = await chatModel.generateContent(prompt);
        const text = result.response.text();

        logApiCall('performResearch', 'success', 'gemini-2.0-flash', { tool, query });
        return { success: true, data: text };

    } catch (err) {
        console.error('Error performing research:', err);
        logApiCall('performResearch', 'error', 'gemini-2.0-flash', { error: err.message });
        return { success: false, error: 'Could not perform research.' };
    }
};
