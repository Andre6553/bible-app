import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
    ensureAppSettingsLoaded,
    fetchFreeModeSetting,
    fetchSermonPrepEnabledSetting,
    setCachedFreeMode,
    setCachedSermonPrepEnabled,
    updateFreeModeSetting,
    updateSermonPrepEnabledSetting
} from '../services/appSettingsService';

const AppSettingsContext = createContext({
    freeMode: false,
    freeModeLoading: true,
    sermonPrepEnabled: false,
    sermonPrepLoading: true,
    refreshFreeMode: async () => false,
    refreshSermonPrepEnabled: async () => false,
    setFreeModeEnabled: async () => ({ success: false }),
    setSermonPrepEnabled: async () => ({ success: false })
});

export const useAppSettings = () => useContext(AppSettingsContext);

export const useFreeMode = () => {
    const ctx = useContext(AppSettingsContext);
    return {
        freeMode: ctx.freeMode,
        freeModeLoading: ctx.freeModeLoading,
        refreshFreeMode: ctx.refreshFreeMode,
        setFreeModeEnabled: ctx.setFreeModeEnabled
    };
};

export const FreeModeProvider = ({ children }) => {
    const [freeMode, setFreeMode] = useState(false);
    const [freeModeLoading, setFreeModeLoading] = useState(true);
    const [sermonPrepEnabled, setSermonPrepEnabledState] = useState(false);
    const [sermonPrepLoading, setSermonPrepLoading] = useState(true);

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

    const refreshSermonPrepEnabled = useCallback(async () => {
        setSermonPrepLoading(true);
        const result = await fetchSermonPrepEnabledSetting();
        if (result.success) {
            setSermonPrepEnabledState(result.enabled);
        } else {
            setSermonPrepEnabledState(false);
            setCachedSermonPrepEnabled(false);
        }
        setSermonPrepLoading(false);
        return result.success ? result.enabled : false;
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const { freeMode: loadedFreeMode, sermonPrepEnabled: loadedSermonPrep } =
                await ensureAppSettingsLoaded();
            if (!cancelled) {
                setFreeMode(loadedFreeMode);
                setSermonPrepEnabledState(loadedSermonPrep);
                setFreeModeLoading(false);
                setSermonPrepLoading(false);
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

    const setSermonPrepEnabled = useCallback(async (enabled) => {
        const result = await updateSermonPrepEnabledSetting(enabled);
        if (result.success) {
            setSermonPrepEnabledState(result.enabled);
        }
        return result;
    }, []);

    const value = useMemo(
        () => ({
            freeMode,
            freeModeLoading,
            sermonPrepEnabled,
            sermonPrepLoading,
            refreshFreeMode,
            refreshSermonPrepEnabled,
            setFreeModeEnabled,
            setSermonPrepEnabled
        }),
        [
            freeMode,
            freeModeLoading,
            sermonPrepEnabled,
            sermonPrepLoading,
            refreshFreeMode,
            refreshSermonPrepEnabled,
            setFreeModeEnabled,
            setSermonPrepEnabled
        ]
    );

    return (
        <AppSettingsContext.Provider value={value}>
            {children}
        </AppSettingsContext.Provider>
    );
};
