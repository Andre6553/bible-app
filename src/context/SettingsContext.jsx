import { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
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
    const lastFetchedUserId = useRef(null);

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

        // Single Auth Source
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            const currentUser = session?.user ?? null;
            setUser(currentUser);

            if (currentUser && currentUser.id !== lastFetchedUserId.current) {
                fetchRemoteSettings(currentUser.id);

                // Capture IP on login/session restore
                const shouldCaptureIp = event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION';

                if (shouldCaptureIp) {
                    // [PERFORMANCE] Fire-and-forget IP capture to prevent login hangs
                    (async () => {
                        console.log('[Auth] 📍 Attempting IP capture for user:', currentUser.id, 'on event:', event);
                        try {
                            const ipRes = await fetch('https://api.ipify.org?format=json');
                            if (!ipRes.ok) throw new Error('IP API response not OK: ' + ipRes.status);

                            const ipData = await ipRes.json();
                            console.log('[Auth] 📍 Raw IP Data received:', ipData);

                            if (ipData?.ip) {
                                localStorage.setItem('captured_ip', ipData.ip);

                                const { error: updateError } = await supabase
                                    .from('user_profiles')
                                    .update({
                                        last_ip: ipData.ip,
                                        ip_address: ipData.ip,
                                        last_seen: new Date().toISOString()
                                    })
                                    .eq('user_id', currentUser.id);

                                if (updateError) {
                                    console.error('[Auth] ❌ Database update failed for IP:', updateError);
                                } else {
                                    console.log('[Auth] ✅ IP successfully saved to profile:', ipData.ip);
                                }
                            }
                        } catch (ipErr) {
                            console.warn('[Auth] ⚠️ IP capture process failed:', ipErr.message);
                        }
                    })();
                }
            } else if (!currentUser) {
                lastFetchedUserId.current = null;
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // 2. Fetch from Supabase
    const fetchRemoteSettings = async (userId) => {
        if (!userId || userId === lastFetchedUserId.current) return;
        lastFetchedUserId.current = userId;

        try {
            const { data, error } = await supabase
                .from('user_settings')
                .select('settings')
                .eq('user_id', userId)
                .single();

            if (error && error.code !== 'PGRST116') throw error;

            if (data?.settings) {
                console.log("[Settings] ☁️ Synced from Cloud");
                setSettings(prev => ({ ...prev, ...data.settings }));
                localStorage.setItem('bible_app_settings', JSON.stringify(data.settings));
            } else {
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

    const syncTimeoutRef = useRef(null);
    const updateSettings = (newSettings) => {
        setSettings(prev => {
            const updated = { ...prev, ...newSettings };
            localStorage.setItem('bible_app_settings', JSON.stringify(updated));

            if (user) {
                if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
                syncTimeoutRef.current = setTimeout(() => {
                    pushSettingsToCloud(user.id, updated);
                }, 2000);
            }
            return updated;
        });
    };

    const [profile, setProfile] = useState(null);
    useEffect(() => {
        if (user) {
            fetchProfile(user.id);
        } else {
            setProfile(null);
        }
    }, [user]);

    const fetchProfile = async (userId) => {
        try {
            const { data, error } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error && error.code !== 'PGRST116') throw error;
            setProfile(data);
        } catch (err) {
            console.error("[Settings] ❌ Profile fetch error:", err.message);
        }
    };

    const contextValue = useMemo(() => ({
        settings,
        updateSettings,
        user,
        profile,
        fetchProfile
    }), [settings, user, profile]);

    return (
        <SettingsContext.Provider value={contextValue}>
            {children}
        </SettingsContext.Provider>
    );
};
