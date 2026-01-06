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
    // State
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentVerseIndex, setCurrentVerseIndex] = useState(0);
    const [voices, setVoices] = useState([]);
    const [selectedVoice, setSelectedVoice] = useState(null);
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

    const isAf = navigator.language?.startsWith('af');

    // Refs
    const synth = window.speechSynthesis;
    const utteranceRef = useRef(null);

    // --- 1. Initialization & Voice Loading ---
    useEffect(() => {
        if (!synth) {
            setDebugInfo(prev => ({ ...prev, state: 'N/A', error: 'Speech API Not Found' }));
            return;
        }

        const loadVoices = () => {
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

            console.log(`[Audio] Loaded ${uniqueVoices.length} unique voices`);
            setDebugInfo(prev => ({
                ...prev,
                voicesCount: uniqueVoices.length,
                state: uniqueVoices.length > 0 ? 'Voices Ready' : 'Probing...'
            }));

            if (uniqueVoices.length > 0) {
                setVoices(uniqueVoices);
                restoreSettings(uniqueVoices);
            }
        };

        // Initial load
        loadVoices();

        // Browser event for voice list updates
        if (synth.onvoiceschanged !== undefined) {
            synth.onvoiceschanged = loadVoices;
        }

        // AGGRESSIVE POLLING: 
        // Mobile Edge/Safari often need multiple attempts or a user gesture
        let pollCount = 0;
        const timer = setInterval(() => {
            pollCount++;
            loadVoices();

            // After 5 attempts (5sec), stop if we have voices
            if (synth.getVoices().length > 1 || pollCount >= 10) {
                clearInterval(timer);
                console.log("[Audio] Polling finished.");
            }
        }, 1000);

        // SILENT PROBE:
        // Some browsers only populate the list after the FIRST speak call.
        // We do a silent probe on mount to attempt to "wake up" the engine.
        setTimeout(() => {
            if (synth.getVoices().length <= 1) {
                console.log("[Audio] Attempting silent probe to wake voices...");
                const probe = new SpeechSynthesisUtterance(' ');
                probe.volume = 0;
                synth.speak(probe);
            }
        }, 500);

        // Restore speed preference
        const savedRate = localStorage.getItem('audio_rate');
        if (savedRate) setRate(parseFloat(savedRate));

        return () => {
            clearInterval(timer);
            cancelSpeech();
        };
    }, []);

    // --- 2. Intelligent Voice Selection ---

    const restoreSettings = (availableVoices) => {
        const savedVoiceURI = localStorage.getItem('audio_voice_uri');
        let voice;

        // A. User Preference
        if (savedVoiceURI) {
            voice = availableVoices.find(v => v.voiceURI === savedVoiceURI);
        }

        // B. Smart Fallback (Afrikaans/Dutch priority if book is Afrikaans-like context, 
        // strictly speaking we should check Bible Version, but we prioritize local user lang match)
        if (!voice) {
            // Try Afrikaans
            voice = availableVoices.find(v => v.lang.startsWith('af'));
            // Try Dutch (close enough for fallback)
            if (!voice) voice = availableVoices.find(v => v.lang.startsWith('nl'));
            // Default to English
            if (!voice) voice = availableVoices.find(v => v.lang.startsWith('en'));
            // Default to first
            if (!voice) voice = availableVoices[0];
        }

        if (voice) setSelectedVoice(voice);
    };

    // --- 3. Playback Logic ---

    // Effect: Handle Verse Change or Play/Pause
    useEffect(() => {
        if (isPlaying && verses.length > 0) {
            // Note: On mobile, this auto-play only works if the context was unlocked by a user click
            playVerse(currentVerseIndex);
        } else if (!isPlaying) {
            cancelSpeech();
        }
    }, [isPlaying, currentVerseIndex, selectedVoice, rate]);

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

        if (selectedVoice) utterance.voice = selectedVoice;
        utterance.rate = rate;
        utterance.pitch = 1.0;

        utterance.onstart = () => {
            setDebugInfo(prev => ({ ...prev, state: 'Speaking...' }));
        };

        utterance.onend = () => {
            // Move to next verse automatically
            if (isPlaying) {
                setCurrentVerseIndex(prev => prev + 1);
            }
        };

        utterance.onerror = (e) => {
            console.error('Audio Error:', e);
            setDebugInfo(prev => ({ ...prev, error: e.error, state: 'Error' }));
            if (e.error !== 'interrupted') {
                setIsPlaying(false);
            }
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

            // 2. Start the actual verse immediately to ensure the click context is used
            playVerse(currentVerseIndex);
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
        setSelectedVoice(voice);
        localStorage.setItem('audio_voice_uri', uri);

        // If playing, we need a direct restart to satisfy gesture rules in some browsers
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

        // 1. Try standard load
        const v = synth.getVoices();
        if (v.length > 0) {
            setVoices(v);
            restoreSettings(v);
            setDebugInfo(prev => ({ ...prev, voicesCount: v.length, state: 'Force Loaded' }));
            return;
        }

        // 2. Play a "silent" utterance. 
        // This is a known hack to "wake up" the speech engine on Mobile Edge/Safari
        setDebugInfo(prev => ({ ...prev, state: 'Probing...' }));
        const probe = new SpeechSynthesisUtterance(' ');
        probe.volume = 0;

        probe.onend = () => {
            const v2 = synth.getVoices();
            if (v2.length > 0) {
                setVoices(v2);
                restoreSettings(v2);
                setDebugInfo(prev => ({ ...prev, voicesCount: v2.length, state: 'Probed OK' }));
            } else {
                setDebugInfo(prev => ({ ...prev, state: 'Probe Final Fail' }));
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
                            <span className="audio-verse-num">
                                v.{verses[currentVerseIndex]?.verse}
                                {voices.length === 0 && <span style={{ fontSize: '10px', color: '#ffaa00' }}> (No voices listed)</span>}
                            </span>
                        </div>

                        <div className="transport-buttons">
                            <button className="transport-btn secondary" onClick={handlePrev}>⏮️</button>
                            <button className="transport-btn play-pause-btn" onClick={togglePlay}>
                                {isPlaying ? '⏸️' : '▶️'}
                            </button>
                            <button className="transport-btn secondary" onClick={handleNext}>⏭️</button>
                        </div>

                        <div className="extra-actions">
                            {voices.length === 0 && (
                                <button
                                    onClick={forceLoadVoices}
                                    style={{ background: 'none', border: '1px solid #555', color: '#aaa', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', marginRight: '5px' }}
                                >
                                    Force Load
                                </button>
                            )}
                            <button
                                className={`settings-toggle ${showSettings ? 'active' : ''}`}
                                onClick={() => setShowSettings(!showSettings)}
                                title="Audio Settings"
                                disabled={voices.length === 0}
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
                        <label>Voice</label>
                        <select
                            value={selectedVoice?.voiceURI || ''}
                            onChange={handleVoiceChange}
                            className="voice-select"
                        >
                            {voices.map(v => (
                                <option key={v.voiceURI} value={v.voiceURI}>
                                    {v.name} ({v.lang}) {v.localService ? '(Offline)' : '(Online)'}
                                </option>
                            ))}
                        </select>
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
