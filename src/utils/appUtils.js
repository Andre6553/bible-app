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
