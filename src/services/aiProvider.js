import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Shared AI provider with Gemini model fallbacks and cross-provider failover.
 *
 * gemini-2.0-flash no longer has free-tier quota (limit: 0). Prefer 2.5 models,
 * then fall back across models / to Groq when a provider is rate-limited.
 */

const AI_PROVIDER = (import.meta.env.VITE_AI_PROVIDER || 'gemini').toLowerCase();
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash';
const GROQ_MODEL = import.meta.env.VITE_GROQ_MODEL || 'llama-3.1-8b-instant';

const GEMINI_FALLBACK_MODELS = [
    GEMINI_MODEL,
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash',
].filter((model, index, arr) => model && arr.indexOf(model) === index);

const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

function isRateLimitError(errorOrText) {
    const text = typeof errorOrText === 'string'
        ? errorOrText
        : `${errorOrText?.message || ''} ${errorOrText?.status || ''}`;
    const lower = text.toLowerCase();
    return (
        lower.includes('429') ||
        lower.includes('quota') ||
        lower.includes('rate limit') ||
        lower.includes('resource_exhausted') ||
        lower.includes('too many requests')
    );
}

function extractRetrySeconds(errorOrText) {
    const text = typeof errorOrText === 'string'
        ? errorOrText
        : `${errorOrText?.message || ''}`;
    const match = text.match(/retry in ([\d.]+)\s*s/i);
    if (!match) return null;
    return Math.max(1, Math.ceil(parseFloat(match[1])));
}

export function getAiProvider() {
    return AI_PROVIDER;
}

export function getAiModelLabel() {
    if (AI_PROVIDER === 'groq') return GROQ_MODEL;
    return GEMINI_MODEL;
}

export function formatAiUserError(error, fallback = 'Failed to get AI response. Please try again.') {
    const errMsg = error?.message || String(error || '');
    const lower = errMsg.toLowerCase();
    const retrySeconds = extractRetrySeconds(errMsg);

    if (isRateLimitError(errMsg)) {
        if (retrySeconds) {
            return `AI is temporarily rate-limited. Please wait about ${retrySeconds}s and try again.`;
        }
        return 'AI rate limit reached. Please wait a minute and try again.';
    }
    if (lower.includes('api key') || lower.includes('api_key') || lower.includes('missing')) {
        return 'API configuration error. Please contact support.';
    }
    if (lower.includes('network') || lower.includes('fetch') || lower.includes('failed to fetch')) {
        return 'Network error. Please check your connection and try again.';
    }
    if (lower.includes('timeout')) {
        return 'Request timed out. Please try again.';
    }
    if (lower.includes('blocked') || lower.includes('safety')) {
        return 'Content was blocked by safety filters. Please rephrase and try again.';
    }
    if (lower.includes('model') || lower.includes('not found')) {
        return 'AI model error. Please try again later.';
    }
    return fallback;
}

async function callGroq(prompt, { temperature = 0.4, maxOutputTokens, responseFormat } = {}) {
    if (!GROQ_API_KEY) {
        throw new Error('Groq API key is missing. Set VITE_GROQ_API_KEY in .env');
    }

    const body = {
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature
    };
    if (maxOutputTokens) body.max_tokens = maxOutputTokens;
    if (responseFormat) body.response_format = responseFormat;

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
        const error = new Error(`Groq API error (${response.status}): ${errText}`);
        error.status = response.status;
        throw error;
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
        throw new Error('Groq API returned an empty response');
    }
    return content;
}

async function callGemini(prompt, { generationConfig } = {}) {
    if (!genAI) {
        throw new Error('Gemini API key is missing. Set VITE_GEMINI_API_KEY in .env');
    }

    let lastError = null;

    for (const modelName of GEMINI_FALLBACK_MODELS) {
        try {
            const model = genAI.getGenerativeModel({
                model: modelName,
                ...(generationConfig ? { generationConfig } : {})
            });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            if (modelName !== GEMINI_MODEL) {
                console.warn(`Gemini model "${GEMINI_MODEL}" unavailable; used "${modelName}" instead.`);
            }
            return response.text();
        } catch (error) {
            lastError = error;
            if (isRateLimitError(error) || /not found|404|unsupported/i.test(error?.message || '')) {
                console.warn(`Gemini model "${modelName}" failed (${error.message?.slice(0, 120) || 'error'}), trying next fallback.`);
                continue;
            }
            throw error;
        }
    }

    throw lastError || new Error('All Gemini models failed');
}

/**
 * Generate text via the configured provider, with cross-provider failover on rate limits.
 *
 * @param {string} prompt
 * @param {{ temperature?: number, maxOutputTokens?: number, responseFormat?: object, generationConfig?: object }} [options]
 */
export async function generateAiText(prompt, options = {}) {
    const {
        temperature = 0.4,
        maxOutputTokens,
        responseFormat,
        generationConfig
    } = options;

    const groqOpts = { temperature, maxOutputTokens, responseFormat };
    const geminiOpts = {
        generationConfig: {
            ...(generationConfig || {}),
            ...(maxOutputTokens ? { maxOutputTokens } : {}),
            ...(temperature !== undefined ? { temperature } : {})
        }
    };
    // Avoid sending empty generationConfig objects to the SDK.
    if (!Object.keys(geminiOpts.generationConfig).length) {
        delete geminiOpts.generationConfig;
    }

    if (AI_PROVIDER === 'groq') {
        try {
            return await callGroq(prompt, groqOpts);
        } catch (error) {
            const status = error?.status;
            if ((status === 429 || status >= 500 || isRateLimitError(error)) && genAI) {
                console.warn(`Groq unavailable (${status || 'error'}), falling back to Gemini.`);
                return callGemini(prompt, geminiOpts);
            }
            throw error;
        }
    }

    try {
        return await callGemini(prompt, geminiOpts);
    } catch (error) {
        if (isRateLimitError(error) && GROQ_API_KEY) {
            console.warn('Gemini rate-limited/quota exceeded, falling back to Groq.');
            return callGroq(prompt, groqOpts);
        }
        throw error;
    }
}
