import { supabase } from '../config/supabaseClient';
import { getUserId } from './bibleService';

/**
 * Parses simple device info from User Agent and globals
 */
const getDeviceInfo = () => {
    const ua = navigator.userAgent;
    let os = 'Unknown';
    if (ua.indexOf('Win') !== -1) os = 'Windows';
    if (ua.indexOf('Mac') !== -1) os = 'MacOS';
    if (ua.indexOf('Linux') !== -1) os = 'Linux';
    if (ua.indexOf('Android') !== -1) os = 'Android';
    if (ua.indexOf('like Mac') !== -1) os = 'iOS';

    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

    return {
        os,
        browser: ua,
        screen: {
            width: window.screen.width,
            height: window.screen.height,
            scale: window.devicePixelRatio
        },
        connection: conn ? {
            type: conn.effectiveType, // '4g', '3g', etc.
            saveData: conn.saveData
        } : 'unknown',
        memory: navigator.deviceMemory || 'unknown', // RAM in GB (approx)
        cores: navigator.hardwareConcurrency || 'unknown'
    };
};

/**
 * Log an error to Supabase
 * @param {Error|String} error - The error object or message
 * @param {Object} context - Additional context (componentStack, metadata)
 */
export const logError = async (error, context = {}) => {
    try {
        // Prevent logging loops if Supabase is down
        if (window._isLoggingError) return;
        window._isLoggingError = true;

        const userId = getUserId();
        const deviceInfo = getDeviceInfo();

        const errorMsg = error instanceof Error ? error.message : String(error);
        const stackTrace = error instanceof Error ? error.stack : null;

        const payload = {
            user_id: userId,
            error_message: errorMsg,
            stack_trace: stackTrace,
            component_stack: context.componentStack || null,
            url: window.location.href,
            user_agent: navigator.userAgent,
            device_info: deviceInfo,
            metadata: context.metadata || {},
            created_at: new Date().toISOString()
        };

        // Await the insert so callers can wait for it if they want
        const { error: insertError } = await supabase.from('app_errors').insert(payload);

        if (insertError) console.error('Failed to send error log:', insertError);
        window._isLoggingError = false;
        return { success: !insertError, error: insertError };

    } catch (loggingErr) {
        console.error('CRITICAL: Error logger failed:', loggingErr);
        window._isLoggingError = false;
    }
};

/**
 * Initialize global event listeners for uncaught errors
 */
export const initGlobalErrorListeners = () => {
    // 1. Window Errors (Syntax errors, throw new Error)
    window.onerror = (message, source, lineno, colno, error) => {
        logError(error || message, {
            metadata: { source, lineno, colno, type: 'uncaught_exception' }
        });
        // return false to ensure standard console print occurs too
        return false;
    };

    // 2. Unhandled Promise Rejections (Async/Await errors)
    window.onunhandledrejection = (event) => {
        logError(event.reason || 'Unhandled Promise Rejection', {
            metadata: { type: 'unhandled_rejection' }
        });
    };

    console.log('✅ Global Error Reporting Initialized');
};
