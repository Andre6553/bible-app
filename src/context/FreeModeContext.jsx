import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
    ensureFreeModeLoaded,
    fetchFreeModeSetting,
    setCachedFreeMode,
    updateFreeModeSetting
} from '../services/appSettingsService';

const FreeModeContext = createContext({
    freeMode: false,
    freeModeLoading: true,
    refreshFreeMode: async () => false,
    setFreeModeEnabled: async () => ({ success: false })
});

export const useFreeMode = () => useContext(FreeModeContext);

export const FreeModeProvider = ({ children }) => {
    const [freeMode, setFreeMode] = useState(false);
    const [freeModeLoading, setFreeModeLoading] = useState(true);

    const refreshFreeMode = useCallback(async () => {
        setFreeModeLoading(true);
        const result = await fetchFreeModeSetting();
        if (result.success) {
            setFreeMode(result.enabled);
        } else {
            setFreeMode(false);
            setCachedFreeMode(false);
        }
        setFreeModeLoading(false);
        return result.success ? result.enabled : false;
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const enabled = await ensureFreeModeLoaded();
            if (!cancelled) {
                setFreeMode(enabled);
                setFreeModeLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const setFreeModeEnabled = useCallback(async (enabled) => {
        const result = await updateFreeModeSetting(enabled);
        if (result.success) {
            setFreeMode(result.enabled);
        }
        return result;
    }, []);

    const value = useMemo(
        () => ({
            freeMode,
            freeModeLoading,
            refreshFreeMode,
            setFreeModeEnabled
        }),
        [freeMode, freeModeLoading, refreshFreeMode, setFreeModeEnabled]
    );

    return (
        <FreeModeContext.Provider value={value}>
            {children}
        </FreeModeContext.Provider>
    );
};
