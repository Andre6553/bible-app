
import { createContext, useContext, useState, useEffect } from 'react';

const SettingsContext = createContext();

export const useSettings = () => {
    return useContext(SettingsContext);
};

export const SettingsProvider = ({ children }) => {
    // Default Settings
    const [settings, setSettings] = useState({
        fontSize: 18, // Default 18px
        fontFamily: 'sans-serif', // 'sans-serif' or 'serif'
        themeColor: '#6366f1', // Default Indigo
        language: 'en' // 'en' or 'af'
    });

    // Load from localStorage on mount
    useEffect(() => {
        const savedSettings = localStorage.getItem('bible_app_settings');
        if (savedSettings) {
            try {
                const parsed = JSON.parse(savedSettings);
                // Merge with existing defaults to ensure new keys (like language) are preserved
                setSettings(prev => ({ ...prev, ...parsed }));
            } catch (e) {
                console.error("Failed to parse settings", e);
            }
        }
    }, []);

    // Save to localStorage on change
    const updateSettings = (newSettings) => {
        setSettings(prev => {
            const updated = { ...prev, ...newSettings };
            localStorage.setItem('bible_app_settings', JSON.stringify(updated));
            return updated;
        });
    };

    return (
        <SettingsContext.Provider value={{ settings, updateSettings }}>
            {children}
        </SettingsContext.Provider>
    );
};
