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

        // [NEW] Squelch Noise: Don't log "Mitigated" chunk errors as separate crashes
        // if they've already been tagged by the handler below.
        if (context.metadata?.mitigated && context.metadata?.type === 'chunk_load_failure') {
            console.log('🔇 Suppressing redundant cloud-sync log (handled by reload)');
            // Optional: We could still log to a different "system_events" table if we wanted
        }

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

    // 3. VITE CHUNK LOADING ERRORS
    // This happens frequently on Vercel after a new deployment when user has an old session open.
    const triggerMitigatedReload = (type, msg) => {
        const lastReload = sessionStorage.getItem('last_chunk_reload');
        const now = Date.now();

        // 1. Log a specialized "Mitigated" event once so we know it's happening, 
        // but avoid a full-blown crash report cluttering the UI.
        logError(`Update Required: ${type}`, {
            metadata: { type: 'chunk_load_failure', detail: msg, mitigated: true }
        });

        // 2. Perform the reload if not done recently
        if (!lastReload || now - parseInt(lastReload) > 20000) { // 20s guard
            console.warn(`[Mitigation] ${type} detected. Refreshing for latest version...`);
            sessionStorage.setItem('last_chunk_reload', now.toString());
            window.location.reload();
        }
    };

    window.addEventListener('vite:preloadError', (event) => {
        triggerMitigatedReload('Vite Preload Error', 'New chunks available');
    });

    window.addEventListener('error', (e) => {
        const msg = e.message || '';
        const isChunkError =
            msg.includes('Failed to fetch dynamically imported module') ||
            msg.includes('text/html is not a valid JavaScript MIME type') ||
            msg.includes('Importing a module script failed');

        if (isChunkError) {
            triggerMitigatedReload('Cloud Sync Error', msg);
        }
    }, true);

    console.log('✅ Global Error Mitigator Initialized');
};
