// analyticsService.js
// Service for handling Google Analytics (GA4) tracking

const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || 'G-GSBN8Z9XPN';

export const initGA = () => {
    if (typeof window !== 'undefined' && !window.gtag && GA_MEASUREMENT_ID) {
        const script1 = document.createElement('script');
        script1.async = true;
        script1.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
        document.head.appendChild(script1);

        const script2 = document.createElement('script');
        script2.innerHTML = `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}', {
                send_page_view: false // We will handle page views manually via React Router
            });
        `;
        document.head.appendChild(script2);

        console.log('[Analytics] GA4 Initialized:', GA_MEASUREMENT_ID);
    }
};

/**
 * Log a page view manually
 * @param {string} path 
 * @param {string} title 
 */
export const logPageView = (path, title) => {
    if (window.gtag) {
        window.gtag('event', 'page_view', {
            page_path: path,
            page_title: title || document.title,
            send_to: GA_MEASUREMENT_ID
        });
    }
};

/**
 * Log a custom event
 * @param {string} action 
 * @param {Object} params 
 */
export const logEvent = (action, params = {}) => {
    if (window.gtag) {
        window.gtag('event', action, {
            ...params,
            send_to: GA_MEASUREMENT_ID
        });
    }
};

/**
 * Set user identity for cross-device tracking
 * @param {string} userId 
 */
export const setUserId = (userId) => {
    if (window.gtag) {
        window.gtag('config', GA_MEASUREMENT_ID, {
            'user_id': userId
        });
    }
};
