
import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../config/supabaseClient';

const SettingsContext = createContext();

export const useSettings = () => {
    return useContext(SettingsContext);
};

export const SettingsProvider = ({ children }) => {
    // Default Settings
    const [settings, setSettings] = useState({
        fontSize: 18,
        fontFamily: 'sans-serif',
        themeColor: '#6366f1',
        themeMode: 'dark',
        language: 'en'
    });
    const [user, setUser] = useState(null);
    const syncTimeoutRef = useRef(null);

    // 1. Initial Load from localStorage & Auth Listeners
    useEffect(() => {
        // Load local fallback
        const savedSettings = localStorage.getItem('bible_app_settings');
        if (savedSettings) {
            try {
                setSettings(prev => ({ ...prev, ...JSON.parse(savedSettings) }));
            } catch (e) {
                console.error("Failed to parse local settings", e);
            }
        }

        // Listen for Auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            const currentUser = session?.user ?? null;
            setUser(currentUser);
            if (currentUser) {
                fetchRemoteSettings(currentUser.id);
            }
        });

        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            const currentUser = session?.user ?? null;
            setUser(currentUser);
            if (currentUser) fetchRemoteSettings(currentUser.id);
        });

        return () => subscription.unsubscribe();
    }, []);

    // 2. Fetch from Supabase
    const fetchRemoteSettings = async (userId) => {
        try {
            const { data, error } = await supabase
                .from('user_settings')
                .select('settings')
                .eq('user_id', userId)
                .single();

            if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "No rows found"

            if (data?.settings) {
                console.log("[Settings] ☁️ Synced from Cloud");
                setSettings(prev => ({ ...prev, ...data.settings }));
                localStorage.setItem('bible_app_settings', JSON.stringify(data.settings));
            } else {
                // First time user? Push local settings to cloud
                pushSettingsToCloud(userId, settings);
            }
        } catch (err) {
            console.error("[Settings] ❌ Fetch error:", err.message);
        }
    };

    // 3. Push to Supabase
    const pushSettingsToCloud = async (userId, currentSettings) => {
        try {
            const { error } = await supabase
                .from('user_settings')
                .upsert({
                    user_id: userId,
                    settings: currentSettings,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' });

            if (error) throw error;
            console.log("[Settings] ⬆️ Pushed to Cloud");
        } catch (err) {
            console.warn("[Settings] ⚠️ Push failed:", err.message);
        }
    };

    // 4. Update Function (Local + Cloud Sync)
    const updateSettings = (newSettings) => {
        setSettings(prev => {
            const updated = { ...prev, ...newSettings };

            // Local Save
            localStorage.setItem('bible_app_settings', JSON.stringify(updated));

            // Cloud Save (Debounced)
            if (user) {
                if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
                syncTimeoutRef.current = setTimeout(() => {
                    pushSettingsToCloud(user.id, updated);
                }, 2000); // 2 second debounce
            }

            return updated;
        });
    };

    return (
        <SettingsContext.Provider value={{ settings, updateSettings }}>
            {children}
        </SettingsContext.Provider>
    );
};
