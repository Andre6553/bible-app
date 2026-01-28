/**
 * Forcefully resets the application cache by unregistering service workers,
 * deleting browser cache storage, and reloading the page.
 */
export const resetAppCache = async () => {
    if (!window.confirm("This will clear all offline data and refresh the app to the latest version. Continue?")) {
        return;
    }

    try {
        // 1. Unregister Service Workers
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (let registration of registrations) {
                await registration.unregister();
            }
        }

        // 2. Delete Cache Storage
        if ('caches' in window) {
            const keys = await caches.keys();
            for (let key of keys) {
                await caches.delete(key);
            }
        }

        // 3. Clear relevant localStorage items (optional, but good for a "clean" start)
        // Note: Not clearing bible_user_id or highlight data here as those are user-owned data.
        // But we could clear things like version downloads status if needed.

        // 4. Hard Reload
        window.location.reload(true);
    } catch (err) {
        console.error('Failed to reset app cache:', err);
        // Fallback reload
        window.location.reload();
    }
};

/**
 * Copies text to the clipboard using the most compatible method available.
 * Falls back to execCommand('copy') for better mobile support.
 */
export const copyToClipboard = async (text) => {
    if (!text) return false;

    // 1. Try modern API first
    if (navigator.clipboard && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.warn('Modern clipboard API failed, trying fallback...', err);
        }
    }

    // 2. Fallback to hidden textarea
    try {
        const textArea = document.createElement("textarea");
        textArea.value = text;

        // Ensure it's not visible or causing layout shifts
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        textArea.style.opacity = "0";
        textArea.style.pointerEvents = "none";

        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);

        return successful;
    } catch (err) {
        console.error('Final fallback copy failed:', err);
        return false;
    }
};
