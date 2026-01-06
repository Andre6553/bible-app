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
    onPlayStateChange // To notify parent if playing
}) => {
    const isAf = navigator.language?.startsWith('af');

    // State
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentVerseIndex, setCurrentVerseIndex] = useState(0);
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

        return () => {
            clearInterval(timer);
            cancelSpeech();
        };
    }, []);

    // --- 3. Playback Logic ---

    // Effect: Handle Verse Change or Play/Pause
    useEffect(() => {
        if (isPlaying && verses.length > 0) {
            // Guard: Only skip if we are actually currently speaking/pending the RIGHT text
            // AND we didn't just come from a paused state.
            const isAlreadyActive = synth.speaking || synth.pending;
            const isSameText = utteranceRef.current?.text === verses[currentVerseIndex]?.text;

            if (isAlreadyActive && isSameText) {
                // If it's the same and active, but synth is paused (common on some mobile/PCs), resume
                if (synth.paused) synth.resume();
                return;
            }

            playVerse(currentVerseIndex);
        } else if (!isPlaying) {
            cancelSpeech();
        }
    }, [isPlaying, currentVerseIndex, selectedVoice?.voiceURI, rate]);

    const playVerse = (index) => {
        // Stop any current speech
        cancelSpeech();

        if (index >= verses.length) {
            // End of chapter
            handleEndOfChapter();
            return;
        }

        const verseData = verses[index];
        if (!verseData) return;

        // Clean text (remove refs like [1])
        const text = verseData.text.replace(/\[.*?\]/g, '');
        // Build Utterance
        const utterance = new SpeechSynthesisUtterance(text);

        if (selectedVoice) {
            utterance.voice = selectedVoice;
        } else {
            // FALLBACK: If no voices listed, set the language code directly.
            // On Android/Mobile browsers, this often forces the system to use the correct voice pack.
            utterance.lang = selectedLang;
        }
        utterance.rate = rate;
        utterance.pitch = 1.0;

        utterance.onstart = () => {
            setDebugInfo(prev => ({ ...prev, state: 'Speaking...' }));
            // DEEP PROBE: Only run on mobile/restricted browsers (voices === 0)
            // This prevents the "Interrupted" error on PC/Mac
            if (voices.length === 0) {
                setTimeout(loadVoices, 100);
                setTimeout(loadVoices, 1000);
            }
        };

        utterance.onend = () => {
            // Move to next verse automatically
            if (isPlaying) {
                setCurrentVerseIndex(prev => prev + 1);
            }
        };

        utterance.onerror = (e) => {
            // ignore interrupted as it's often a normal part of switching verses
            if (e.error === 'interrupted') return;

            console.error('Audio Error:', e);
            setDebugInfo(prev => ({ ...prev, error: e.error, state: 'Error' }));
            setIsPlaying(false);
        };

        utteranceRef.current = utterance;

        // Final check: some browsers pause the synth if idle
        if (synth.paused) synth.resume();

        synth.speak(utterance);

        // Update UI & External State
        onHighlightVerse && onHighlightVerse(verseData.verse);
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

        // --- MOBILE COMPATIBILITY: PRIME THE ENGINE ---
        // Some mobile browsers (Edge, Safari) require a speak() call directly inside 
        // the click event to "unlock" the audio context.
        if (nextState) {
            // 1. Prime with a tiny bit of silence/empty text if engine is idle
            if (!synth.speaking) {
                const prime = new SpeechSynthesisUtterance(' ');
                prime.volume = 0;
                synth.speak(prime);
            }

            // 2. We do NOT call playVerse here anymore.
            // Setting isPlaying = true will trigger the useEffect,
            // but the prime call above ensures the context is unlocked for mobile.
        }

        setIsPlaying(nextState);
        onPlayStateChange && onPlayStateChange(nextState);
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
