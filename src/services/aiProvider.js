import { GoogleGenerativeAI } from '@google/generative-ai';

export const AI_PROVIDER = (import.meta.env.VITE_AI_PROVIDER || 'gemini').toLowerCase();
export const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
export const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
export const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.0-flash';
export const GROQ_MODEL = import.meta.env.VITE_GROQ_MODEL || 'llama-3.1-8b-instant';

const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;
const geminiModel = genAI ? genAI.getGenerativeModel({ model: GEMINI_MODEL }) : null;

export function getModelLabel() {
    if (AI_PROVIDER === 'groq') return GROQ_MODEL;
    return GEMINI_MODEL;
}

export function isQuotaOrRateLimitError(error) {
    const msg = `${error?.message || ''} ${error?.status || ''}`.toLowerCase();
    return (
        msg.includes('429') ||
        msg.includes('quota') ||
        msg.includes('rate') ||
        msg.includes('resource_exhausted') ||
        msg.includes('too many requests')
    );
}

/**
 * Turn raw provider errors into short, user-facing messages.
 */
export function formatAiError(error, fallback = 'Failed to get AI response. Please try again.') {
    const errMsg = `${error?.message || ''}`.toLowerCase();

    if (errMsg.includes('quota') || errMsg.includes('limit') || errMsg.includes('rate') || errMsg.includes('429')) {
        return 'AI rate limit reached. Please wait a minute and try again.';
    }
    if (errMsg.includes('api key') || errMsg.includes('api_key') || errMsg.includes('invalid')) {
        return 'API configuration error. Please contact support.';
    }
    if (errMsg.includes('network') || errMsg.includes('fetch') || errMsg.includes('failed to fetch')) {
        return 'Network error. Please check your connection and try again.';
    }
    if (errMsg.includes('timeout')) {
        return 'Request timed out. Please try again.';
    }
    if (errMsg.includes('blocked') || errMsg.includes('safety')) {
        return 'Content was blocked by safety filters. Please rephrase your question.';
    }
    if (errMsg.includes('model') || errMsg.includes('not found')) {
        return 'AI model error. Please try again later.';
    }

    return fallback;
}

async function callGroq(prompt, { temperature = 0.4, maxTokens } = {}) {
    if (!GROQ_API_KEY) {
        throw new Error('Groq API key is missing. Set VITE_GROQ_API_KEY in .env');
    }

    const body = {
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature
    };
    if (maxTokens) body.max_tokens = maxTokens;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Groq API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
        throw new Error('Groq API returned an empty response');
    }
    return content;
}

async function callGemini(prompt, { generationConfig } = {}) {
    if (!genAI || !geminiModel) {
        throw new Error('Gemini API key is missing. Set VITE_GEMINI_API_KEY in .env');
    }

    const activeModel = generationConfig
        ? genAI.getGenerativeModel({ model: GEMINI_MODEL, generationConfig })
        : geminiModel;

    const result = await activeModel.generateContent(prompt);
    const response = await result.response;
    return response.text();
}

/**
 * Generate text with automatic provider fallback when one side is rate-limited.
 */
export async function generateAiText(prompt, options = {}) {
    const primary = AI_PROVIDER === 'groq' ? 'groq' : 'gemini';
    const secondary = primary === 'groq' ? 'gemini' : 'groq';

    const run = async (provider) => {
        if (provider === 'groq') return callGroq(prompt, options);
        return callGemini(prompt, options);
    };

    const canFallback = (provider) => {
        if (provider === 'groq') return Boolean(GROQ_API_KEY);
        return Boolean(geminiModel);
    };

    try {
        return await run(primary);
    } catch (primaryError) {
        if (!isQuotaOrRateLimitError(primaryError) || !canFallback(secondary)) {
            throw primaryError;
        }

        console.warn(
            `${primary} unavailable (${primaryError.message?.slice(0, 120)}), falling back to ${secondary}.`
        );

        try {
            return await run(secondary);
        } catch (secondaryError) {
            throw secondaryError;
        }
    }
}
