import React, { useState, useEffect, useRef } from 'react';
import './AudioPlayer.css';

/**
 * Omni Bible Audio Player
 * Uses Web Speech API for native Text-to-Speech
 * Supports Voice Selection, Speed Control, and Background Audio (Media Session)
 */
const AudioPlayer = ({
    verses,
    currentChapter,
    bookName,
    onNextChapter,
    onHighlightVerse,
    onClose,
    onPlayStateChange, // To notify parent if playing
    initialVerseIndex = 0, // New prop: Start at specific verse
    onGetTopVerseIndex // New prop: Function to get current top verse
}) => {
    const isAf = navigator.language?.startsWith('af');

    // State
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentVerseIndex, setCurrentVerseIndex] = useState(initialVerseIndex);
    const [voices, setVoices] = useState([]);
    const [selectedVoice, setSelectedVoice] = useState(null);
    const [selectedLang, setSelectedLang] = useState(localStorage.getItem('audio_lang') || (isAf ? 'af-ZA' : 'en-US'));
    const [rate, setRate] = useState(1.0);
    const [showSettings, setShowSettings] = useState(false);
    const [isMinimize, setIsMinimize] = useState(false);
    const [debugInfo, setDebugInfo] = useState({
        state: 'init',
        error: null,
        voicesCount: 0,
        secure: typeof window !== 'undefined' ? window.isSecureContext : '?'
    });
    const [showDebug, setShowDebug] = useState(false);

    // Refs
    const synth = window.speechSynthesis;
    const utteranceRef = useRef(null);
    const voicesCountRef = useRef(0);
    const selectedVoiceURIRef = useRef(localStorage.getItem('audio_voice_uri') || null);
    const isManuallyTriggeredRef = useRef(false);
    const isPlayingRef = useRef(false);

    // Background Audio Hack 2.0: Web Audio API Oscillator
    // Generates a faint "noise" signal to keep Android audio drivers active.
    // Much more robust than a silent MP3 file loop.
    const audioCtxRef = useRef(null);
    const wakeLockRef = useRef(null);

    // Sync Ref with State for use in async callbacks (onend, timeouts)
    useEffect(() => {
        isPlayingRef.current = isPlaying;
    }, [isPlaying]);

    // --- 1. Initialization & Voice Loading ---
    const loadVoices = () => {
        if (!synth) return;
        // Get all voices
        let allVoices = synth.getVoices();

        // Deduplicate by voiceURI and name (some browsers return duplicates)
        const uniqueVoices = [];
        const seenURIs = new Set();
        for (const v of allVoices) {
            if (!seenURIs.has(v.voiceURI)) {
                uniqueVoices.push(v);
                seenURIs.add(v.voiceURI);
            }
        }

        console.log(`[Audio] Found ${uniqueVoices.length} unique voices (Current: ${voicesCountRef.current})`);

        // Only update state if the number of unique voices has changed OR we are currently empty
        if (uniqueVoices.length > 0 && (uniqueVoices.length !== voicesCountRef.current || voices.length === 0)) {
            voicesCountRef.current = uniqueVoices.length;
            setVoices(uniqueVoices);
            restoreSettings(uniqueVoices);

            setDebugInfo(prev => ({
                ...prev,
                voicesCount: uniqueVoices.length,
                state: 'Voices Ready'
            }));
        } else if (uniqueVoices.length === 0) {
            setDebugInfo(prev => ({
                ...prev,
                state: 'Probing...'
            }));
        }
    };

    const restoreSettings = (availableVoices) => {
        const savedURI = localStorage.getItem('audio_voice_uri') || selectedVoiceURIRef.current;
        let voice;

        // 1. Try to find the saved preference OR the one we currently have in Ref
        if (savedURI) {
            voice = availableVoices.find(v => v.voiceURI === savedURI);
        }

        // 2. If nothing found, use smart fallbacks
        if (!voice) {
            voice = availableVoices.find(v => v.lang.startsWith('af')) ||
                availableVoices.find(v => v.lang.startsWith('nl')) ||
                availableVoices.find(v => v.lang.startsWith('en')) ||
                availableVoices[0];
        }

        if (voice) {
            // Logic: Update state if state is currently null OR if the URI is actually different
            const currentURI = selectedVoiceURIRef.current;
            if (!selectedVoice || voice.voiceURI !== currentURI) {
                console.log(`[Audio] Setting voice: ${voice.name}`);
                selectedVoiceURIRef.current = voice.voiceURI;
                setSelectedVoice(voice);
                setSelectedLang(voice.lang);
            }
        }
    };

    useEffect(() => {
        if (!synth) {
            setDebugInfo(prev => ({ ...prev, state: 'N/A', error: 'Speech API Not Found' }));
            return;
        }

        // Initial load
        loadVoices();

        // Browser event for voice list updates
        if (synth.onvoiceschanged !== undefined) {
            synth.onvoiceschanged = loadVoices;
        }

        // AGGRESSIVE POLLING
        let pollCount = 0;
        const timer = setInterval(() => {
            pollCount++;
            const currentVoices = synth.getVoices();
            if (currentVoices.length > 0) {
                loadVoices();
                clearInterval(timer);
                return;
            }
            if (pollCount >= 10) {
                clearInterval(timer);
            }
        }, 1000);

        // SILENT PROBE
        setTimeout(() => {
            if (synth.getVoices().length <= 1) {
                const probe = new SpeechSynthesisUtterance(' ');
                probe.volume = 0;
                synth.speak(probe);
            }
        }, 500);

        // Restore speed
        const savedRate = localStorage.getItem('audio_rate');
        if (savedRate) setRate(parseFloat(savedRate));

        // WATCHDOG: Occasionally check if we are stuck (isPlaying=true but nothing speaking)
        const watchdog = setInterval(() => {
            if (synth && !synth.speaking && !synth.pending) {
                // If we think we should be playing, but the engine is silent
                // This usually means a transition failed or was GC-ed
                // We don't auto-advance here to avoid skipping, but we log the state
                // and we will let the useEffect handle the restart if needed
                // console.log('[Audio] Watchdog: Engine Idle');
            }
        }, 5000);

        return () => {
            clearInterval(watchdog);
            clearInterval(timer);
            cancelSpeech();
            if (audioCtxRef.current) audioCtxRef.current.close().catch(() => { });
            if (wakeLockRef.current) wakeLockRef.current.release().catch(() => { });
        };
    }, []);

    // --- 3. Playback Logic ---

    // Effect: Handle Verse Change or Play/Pause
    useEffect(() => {
        if (isPlaying && verses.length > 0) {
            console.log(`[Audio] Effect Trigger: isPlaying=${isPlaying}, index=${currentVerseIndex}`);

            // Bypass the effect's playVerse if togglePlay already triggered it manually.
            if (isManuallyTriggeredRef.current) {
                console.log('[Audio] Ignoring effect trigger (manual play already started)');
                isManuallyTriggeredRef.current = false;
                return;
            }

            playVerse(currentVerseIndex);
        } else if (!isPlaying) {
            console.log('[Audio] isPlaying is false, cancelling speech.');
            cancelSpeech();
        }
    }, [isPlaying, currentVerseIndex]); // Simplified deps, verses is usually stable

    const playVerse = (index) => {
        if (!synth) return;

        console.log(`[Audio] playVerse(idx: ${index}) - isPlayingRef: ${isPlayingRef.current}`);

        // Stop any current speech
        cancelSpeech();

        if (index >= verses.length) {
            console.log('[Audio] Index out of bounds, end of chapter.');
            handleEndOfChapter();
            return;
        }

        const verseData = verses[index];
        if (!verseData) return;

        const text = verseData.text.replace(/\[.*?\]/g, '');
        const utterance = new SpeechSynthesisUtterance(text);

        if (selectedVoice) {
            utterance.voice = selectedVoice;
        } else {
            utterance.lang = selectedLang;
        }
        utterance.rate = rate;
        utterance.pitch = 1.0;

        // CRITICAL: Keep a reference to the utterance to prevent Garbage Collection
        window._activeUtterance = utterance;
        utteranceRef.current = utterance;

        utterance.onstart = () => {
            console.log(`[Audio] START: v.${verseData.verse}`);
            setDebugInfo(prev => ({ ...prev, state: 'Speaking...' }));
        };

        utterance.onend = () => {
            console.log(`[Audio] END: v.${verseData.verse}. isPlayingRef: ${isPlayingRef.current}`);
            // Move to next verse automatically
            if (isPlayingRef.current) {
                // Faster check: Update state and trigger next verse immediately
                setCurrentVerseIndex(prev => {
                    const next = prev + 1;
                    console.log(`[Audio] Next Verse -> ${next}`);
                    return next;
                });
            }
        };

        utterance.onerror = (e) => {
            // Mobile browsers often flag 'interrupted' or 'canceled' during transitions
            if (e.error === 'interrupted' || e.error === 'canceled') {
                console.log(`[Audio] Handled Error: ${e.error}`);
                return;
            }

            console.error('[Audio] Critical Error:', e.error);
            setDebugInfo(prev => ({ ...prev, error: e.error, state: e.error }));

            // If the error isn't just a transition issue, stop the player
            if (['network', 'not-allowed', 'language-unavailable'].includes(e.error)) {
                setIsPlaying(false);
            }
        };

        // Resume if paused (browser safety)
        if (synth.paused) synth.resume();

        // Final Speak trigger
        setTimeout(() => {
            if (isPlayingRef.current) {
                console.log(`[Audio] SPEAK EXEC: v.${verseData.verse}`);
                synth.speak(utterance);
            } else {
                console.log(`[Audio] Speak cancelled (isPlayingRef is false)`);
            }
        }, 50); // Slightly longer delay for PC stability

        // Update UI & External State
        if (onHighlightVerse) {
            setTimeout(() => onHighlightVerse(verseData.verse), 100);
        }
        updateMediaSession(verseData);
    };

    const cancelSpeech = () => {
        if (synth && (synth.speaking || synth.pending)) {
            synth.cancel();
            setDebugInfo(prev => ({ ...prev, state: 'Idle' }));
        }
    };

    const handleEndOfChapter = () => {
        console.log('End of chapter reached. Requesting next...');
        // Pause briefly
        setIsPlaying(false);

        // Trigger next chapter load
        if (onNextChapter) {
            onNextChapter();
            // Reset index to 0 for new chapter
            setCurrentVerseIndex(0);
            // Resume playing after short delay to allow load
            setTimeout(() => setIsPlaying(true), 1500);
        } else {
            alert("End of book.");
        }
    };

    // --- 4. Car / Media Session API ---

    const updateMediaSession = (verseData) => {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: `${bookName} ${currentChapter}:${verseData.verse}`,
                artist: 'Omni Bible Audio',
                album: 'Audio Bible',
                artwork: [
                    { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
                    { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }
                ]
            });

            // Handlers
            navigator.mediaSession.setActionHandler('play', () => togglePlay());
            navigator.mediaSession.setActionHandler('pause', () => togglePlay());
            navigator.mediaSession.setActionHandler('previoustrack', handlePrev);
            navigator.mediaSession.setActionHandler('nexttrack', handleNext);
        }
    };

    // --- 5. Handlers ---

    const togglePlay = () => {
        const nextState = !isPlaying;

        // --- CRITICAL ORDER ---
        // 1. Update the Ref FIRST so playVerse sees the update immediately
        isPlayingRef.current = nextState;

        // 2. Update the State for React UI
        setIsPlaying(nextState);
        onPlayStateChange && onPlayStateChange(nextState);

        if (nextState) {
            // New logic: If the user paused and scrolled, re-anchor to the top visible verse
            let startAt = currentVerseIndex;
            if (onGetTopVerseIndex) {
                const topIndex = onGetTopVerseIndex();
                console.log(`[Audio] Resume Sync: Paused at ${currentVerseIndex}, Scrolled to ${topIndex}`);
                startAt = topIndex;
                setCurrentVerseIndex(topIndex);
            }

            // 3. Trigger playback + Background Audio Keep-Alive
            try {
                // Initialize Audio Context if missing
                if (!audioCtxRef.current) {
                    const AudioContext = window.AudioContext || window.webkitAudioContext;
                    if (AudioContext) {
                        const ctx = new AudioContext();
                        // Create a specific 15khz tone (barely audible) - some OS's gate "silence" (0hz)
                        const osc = ctx.createOscillator();
                        const gain = ctx.createGain();

                        osc.type = 'sine';
                        osc.frequency.setValueAtTime(15000, ctx.currentTime); // High freq for less perceptibility
                        gain.gain.setValueAtTime(0.001, ctx.currentTime); // Very low gain

                        osc.connect(gain);
                        gain.connect(ctx.destination);
                        osc.start();

                        audioCtxRef.current = ctx;
                        console.log('🔊 Web Audio Context Created');
                    }
                }

                // Resume Context if suspended
                if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
                    audioCtxRef.current.resume().then(() => console.log('🔊 Web Audio Resumed'));
                }
            } catch (e) {
                console.warn('Web Audio Init Failed', e);
            }

            // Request Screen Wake Lock
            if ('wakeLock' in navigator) {
                navigator.wakeLock.request('screen')
                    .then(lock => {
                        wakeLockRef.current = lock;
                        console.log('💡 Wake Lock active');
                    })
                    .catch(e => console.warn('Wake Lock failed:', e));
            }

            isManuallyTriggeredRef.current = true;
            playVerse(startAt);
        } else {
            // Suspend Web Audio to save battery/resources when paused
            if (audioCtxRef.current && audioCtxRef.current.state === 'running') {
                audioCtxRef.current.suspend().then(() => console.log('🔇 Web Audio Suspended'));
            }

            // Release Wake Lock
            if (wakeLockRef.current) {
                wakeLockRef.current.release()
                    .then(() => console.log('💡 Wake Lock released'))
                    .catch(e => console.warn('Wake Lock release error:', e));
                wakeLockRef.current = null;
            }
            cancelSpeech();
        }
    };

    const handleNext = () => {
        const nextIndex = currentVerseIndex + 1;
        setCurrentVerseIndex(nextIndex);
        // If we were playing, playVerse will be triggered by useEffect
    };

    const handlePrev = () => {
        const nextIndex = currentVerseIndex > 0 ? currentVerseIndex - 1 : 0;
        setCurrentVerseIndex(nextIndex);
    };

    const handleVoiceChange = (e) => {
        const uri = e.target.value;
        const voice = voices.find(v => v.voiceURI === uri);
        if (voice) {
            selectedVoiceURIRef.current = voice.voiceURI;
            setSelectedVoice(voice);
            setSelectedLang(voice.lang);
            localStorage.setItem('audio_voice_uri', uri);
        }

        // If playing, we need a direct restart to satisfy gesture rules in some browsers
        if (isPlaying) {
            playVerse(currentVerseIndex);
        }
    };

    const handleLangChange = (e) => {
        const lang = e.target.value;
        setSelectedLang(lang);
        localStorage.setItem('audio_lang', lang);

        // If playing, restart to apply language change
        if (isPlaying) {
            playVerse(currentVerseIndex);
        }
    };

    const handleRateChange = (newRate) => {
        setRate(newRate);
        localStorage.setItem('audio_rate', newRate);
    };

    // Aggressive Force-Load for Mobile Browsers
    const forceLoadVoices = () => {
        if (!synth) return;

        const rawVoices = synth.getVoices();
        const diagnosticInfo = [
            `Raw count: ${rawVoices.length}`,
            `Synth State: ${synth.speaking ? 'Speaking' : 'Idle'}`,
            `Pending: ${synth.pending}`,
            `Paused: ${synth.paused}`,
            `Secure: ${window.isSecureContext}`
        ].join('\n');

        console.log('[Audio] Deep Scan Info:', diagnosticInfo);

        // 1. Try standard load
        if (rawVoices.length > 0) {
            setVoices(rawVoices);
            restoreSettings(rawVoices);
            alert(`Voices Found!\n${diagnosticInfo}\nFirst: ${rawVoices[0].name}`);
            return;
        }

        // 2. Play a "silent" utterance to wake up engine
        const probe = new SpeechSynthesisUtterance(' ');
        probe.volume = 0;

        probe.onend = () => {
            const v2 = synth.getVoices();
            if (v2.length > 0) {
                setVoices(v2);
                restoreSettings(v2);
                alert(`Probe Success!\n${diagnosticInfo}\nNew Count: ${v2.length}`);
            } else {
                alert(`Deep Scan Fail.\n${diagnosticInfo}\nStill 0 voices.`);
            }
        };

        synth.speak(probe);
    };

    if (!synth) return null;

    return (
        <div className={`audio-player-container ${isMinimize ? 'minimized' : ''}`}>
            {/* Always show controls if synth exists, even if 0 voices (default might work) */}
            <div className="audio-controls">
                {isMinimize && (
                    <div className="mini-info" onClick={() => setIsMinimize(false)}>
                        <span className="audio-pulse-icon">{isPlaying ? '🔊' : '🔈'}</span>
                        <span className="mini-text">{bookName} {currentChapter}:{verses[currentVerseIndex]?.verse}</span>
                    </div>
                )}

                {!isMinimize && (
                    <>
                        <div className="track-info">
                            <span className="audio-book-title">{bookName} {currentChapter}</span>
                            <span className="audio-verse-num">v.{verses[currentVerseIndex]?.verse}</span>
                        </div>

                        <div className="transport-buttons">
                            <button className="transport-btn secondary" onClick={handlePrev}>⏮️</button>
                            <button className="transport-btn play-pause-btn" onClick={togglePlay}>
                                {isPlaying ? '⏸️' : '▶️'}
                            </button>
                            <button className="transport-btn secondary" onClick={handleNext}>⏭️</button>
                        </div>

                        <div className="extra-actions">
                            <button
                                className={`settings-toggle ${showSettings ? 'active' : ''}`}
                                onClick={() => setShowSettings(!showSettings)}
                                title="Audio Settings"
                            >
                                ⚙️
                            </button>
                            <button className="minimize-btn" onClick={() => setIsMinimize(true)}>
                                🔽
                            </button>
                            <button className="close-btn" onClick={() => { setIsPlaying(false); onClose(); }}>
                                ✕
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* Settings Drawer */}
            {showSettings && !isMinimize && (
                <div className="audio-settings-drawer">
                    <div className="setting-row">
                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '4px' }}>
                            <label>{voices.length > 0 ? 'Voice' : 'Language'}</label>
                            {voices.length === 0 && (
                                <button
                                    onClick={forceLoadVoices}
                                    style={{ background: 'none', border: '1px solid #444', color: '#888', padding: '1px 4px', fontSize: '9px', borderRadius: '3px' }}
                                >
                                    Diagnose
                                </button>
                            )}
                        </div>

                        {voices.length > 0 ? (
                            <select
                                value={selectedVoice?.voiceURI || ''}
                                onChange={handleVoiceChange}
                                className="voice-select"
                            >
                                {voices.map(v => (
                                    <option key={v.voiceURI} value={v.voiceURI}>
                                        {v.name} ({v.lang})
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <select
                                value={selectedLang}
                                onChange={handleLangChange}
                                className="voice-select"
                            >
                                <option value="af-ZA">Afrikaans (System Default)</option>
                                <option value="en-US">English (US Default)</option>
                                <option value="en-GB">English (UK Default)</option>
                            </select>
                        )}
                    </div>

                    <div className="setting-row">
                        <label>Speed: {rate}x</label>
                        <div className="speed-options">
                            {[0.75, 1.0, 1.25, 1.5, 2.0].map(r => (
                                <button
                                    key={r}
                                    className={`speed-btn ${rate === r ? 'active' : ''}`}
                                    onClick={() => handleRateChange(r)}
                                >
                                    {r}x
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AudioPlayer;
