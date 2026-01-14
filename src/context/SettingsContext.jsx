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
    const [authLoading, setAuthLoading] = useState(true);

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
            setAuthLoading(false); // Auth check complete

            if (currentUser && currentUser.id !== lastFetchedUserId.current) {
                // ... (rest of logic)
                fetchRemoteSettings(currentUser.id);

                // Capture IP on login/session restore
                const shouldCaptureIp = event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION';

                if (shouldCaptureIp) {
                    // [PERFORMANCE] Fire-and-forget IP capture to prevent login hangs
                    (async () => {
                        console.log('[Auth] 📍 Attempting IP capture for user:', currentUser.id, 'on event:', event);
                        // ... (rest of IP logic)
                        try {
                            const ipRes = await fetch('https://api.ipify.org?format=json');
                            if (!ipRes.ok) throw new Error('IP API response not OK: ' + ipRes.status);

                            const ipData = await ipRes.json();
                            // console.log('[Auth] 📍 Raw IP Data received:', ipData);

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

    // ... (rest of file)

    return (
        <SettingsContext.Provider value={{
            settings,
            updateSettings,
            user,
            authLoading, // Exporting loading state
            manualSetUser: setUser,
            profile: null,
            fetchProfile: fetchRemoteSettings
        }}>
            {children}
        </SettingsContext.Provider>
    );
};
