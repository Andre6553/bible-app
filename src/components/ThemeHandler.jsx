
import { useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';

/**
 * Component to apply global theme styles based on settings.
 * Must be rendered inside SettingsProvider.
 */
function ThemeHandler() {
    const { settings } = useSettings();

    useEffect(() => {
        if (settings.themeColor) {
            const root = document.documentElement;
            // Set primary accent
            root.style.setProperty('--accent-primary', settings.themeColor);

            // Set derived colors using color-mix for browser support
            // If browser doesn't support color-mix, it falls back to primary or needs polyfill
            // Modern browsers support it.
            root.style.setProperty('--accent-secondary', `color-mix(in srgb, ${settings.themeColor}, white 20%)`);
            root.style.setProperty('--accent-dark', `color-mix(in srgb, ${settings.themeColor}, black 20%)`);
        }
    }, [settings.themeColor]);

    return null; // Logic only
}

export default ThemeHandler;
