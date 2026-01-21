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

        const userId = await getUserId();
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

    // 3. VITE CHUNK LOADING ERRORS (Mitigation for "Failed to fetch dynamically imported module")
    // This happens frequently on Vercel after a new deployment when user has an old session open.
    window.addEventListener('vite:preloadError', (event) => {
        console.warn('Vite preload error detected. Forcing reload to get latest chunks...');
        logError('Vite Preload Error', { metadata: { type: 'vite_preload_error', url: window.location.href } });

        // Don't loop infinitely - only reload if we haven't reloaded in the last 10s
        const lastReload = sessionStorage.getItem('last_chunk_reload');
        const now = Date.now();
        if (!lastReload || now - parseInt(lastReload) > 10000) {
            sessionStorage.setItem('last_chunk_reload', now.toString());
            window.location.reload();
        }
    });

    // 4. MIME type errors & generic script failure detection
    window.addEventListener('error', (e) => {
        const msg = e.message || '';
        if (msg.includes('Failed to fetch dynamically imported module') ||
            msg.includes('text/html is not a valid JavaScript MIME type') ||
            msg.includes('Importing a module script failed')) {

            console.warn('Chunk loading error detected via observer. Reloading...', msg);

            const lastReload = sessionStorage.getItem('last_chunk_reload');
            const now = Date.now();
            if (!lastReload || now - parseInt(lastReload) > 10000) {
                sessionStorage.setItem('last_chunk_reload', now.toString());
                window.location.reload();
            }
        }
    }, true);

    console.log('✅ Global Error Reporting Initialized');
};
