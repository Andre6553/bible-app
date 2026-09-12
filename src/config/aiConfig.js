/**
 * Shared AI provider settings.
 * Groq deprecated llama-3.1-8b-instant on 2026-08-16; replacement: openai/gpt-oss-20b.
 */
export const AI_PROVIDER = (import.meta.env.VITE_AI_PROVIDER || 'gemini').toLowerCase();
export const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
export const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
export const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.0-flash';
export const GROQ_MODEL = import.meta.env.VITE_GROQ_MODEL || 'openai/gpt-oss-20b';

export const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';

/** Defaults for openai/gpt-oss-* reasoning models on Groq. */
export const GROQ_CHAT_DEFAULTS = {
    max_completion_tokens: 4096,
    include_reasoning: false,
    reasoning_effort: 'low',
};

/** Groq errors that should fall back to Gemini when available. */
export function shouldFallbackFromGroq(status) {
    return status === 404 || status === 429 || status >= 500;
}

/** Build a Groq chat/completions request body. */
export function buildGroqChatBody(prompt, options = {}) {
    const body = {
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: options.temperature ?? 0.5,
        max_completion_tokens:
            options.max_completion_tokens ??
            options.max_tokens ??
            GROQ_CHAT_DEFAULTS.max_completion_tokens,
        include_reasoning: options.include_reasoning ?? GROQ_CHAT_DEFAULTS.include_reasoning,
        reasoning_effort: options.reasoning_effort ?? GROQ_CHAT_DEFAULTS.reasoning_effort,
    };

    if (options.response_format) {
        body.response_format = options.response_format;
    }

    return body;
}

/** Extract visible assistant text from a Groq chat/completions JSON payload. */
export function extractGroqMessageContent(data) {
    const choice = data?.choices?.[0];
    const message = choice?.message;
    const finishReason = choice?.finish_reason ?? null;

    if (!message) {
        return { content: null, finishReason };
    }

    const content = typeof message.content === 'string' ? message.content.trim() : '';
    if (content) {
        return { content, finishReason };
    }

    const reasoning = typeof message.reasoning === 'string' ? message.reasoning.trim() : '';
    return { content: reasoning || null, finishReason };
}
