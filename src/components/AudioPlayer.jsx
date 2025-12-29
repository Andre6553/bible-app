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

    // Refs
    const synth = window.speechSynthesis;
    const utteranceRef = useRef(null);

    // --- 1. Initialization & Voice Loading ---

    useEffect(() => {
        const loadVoices = () => {
            let available = synth.getVoices();
            if (available.length > 0) {
                setVoices(available);
                restoreSettings(available);
            }
        };

        loadVoices();

        // Chrome loads voices asynchronously
        if (synth.onvoiceschanged !== undefined) {
            synth.onvoiceschanged = loadVoices;
        }

        // Restore speed
        const savedRate = localStorage.getItem('audio_rate');
        if (savedRate) setRate(parseFloat(savedRate));

        return () => {
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
            playVerse(currentVerseIndex);
        } else {
            cancelSpeech();
        }
    }, [isPlaying, currentVerseIndex, selectedVoice, rate, verses]); // Re-run if these change

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

        // Events
        utterance.onend = () => {
            // Move to next verse automatically
            if (isPlaying) {
                setCurrentVerseIndex(prev => prev + 1);
            }
        };

        utterance.onerror = (e) => {
            console.error('Audio Error:', e);
            if (e.error !== 'interrupted') {
                setIsPlaying(false);
            }
        };

        // boundary for word highlighting? (future)
        // utterance.onboundary = ...

        utteranceRef.current = utterance;
        synth.speak(utterance);

        // Update UI & External State
        onHighlightVerse && onHighlightVerse(verseData.verse);
        updateMediaSession(verseData);
    };

    const cancelSpeech = () => {
        if (synth.speaking || synth.pending) {
            synth.cancel();
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
            navigator.mediaSession.setActionHandler('play', () => setIsPlaying(true));
            navigator.mediaSession.setActionHandler('pause', () => setIsPlaying(false));
            navigator.mediaSession.setActionHandler('previoustrack', handlePrev);
            navigator.mediaSession.setActionHandler('nexttrack', handleNext);
        }
    };

    // --- 5. Handlers ---

    const togglePlay = () => {
        setIsPlaying(!isPlaying);
        onPlayStateChange && onPlayStateChange(!isPlaying);
    };

    const handleNext = () => {
        setCurrentVerseIndex(prev => prev + 1); // Logic will handle end of chapter
    };

    const handlePrev = () => {
        setCurrentVerseIndex(prev => (prev > 0 ? prev - 1 : 0));
    };

    const handleVoiceChange = (e) => {
        const uri = e.target.value;
        const voice = voices.find(v => v.voiceURI === uri);
        setSelectedVoice(voice);
        localStorage.setItem('audio_voice_uri', uri);

        // Restart if playing to apply voice
        if (isPlaying) {
            cancelSpeech();
            // Trigger effect re-run
            // The effect dependency [selectedVoice] will restart it
        }
    };

    const handleRateChange = (newRate) => {
        setRate(newRate);
        localStorage.setItem('audio_rate', newRate);
    };

    if (voices.length === 0) return null; // Don't render if TTS not supported

    return (
        <div className={`audio-player-container ${isMinimize ? 'minimized' : ''}`}>

            {/* Main Player Bar */}
            <div className="audio-controls">

                {/* Minimized View: Just Icon & verse */}
                {isMinimize && (
                    <div className="mini-info" onClick={() => setIsMinimize(false)}>
                        <span className="audio-pulse-icon">{isPlaying ? '🔊' : '🔈'}</span>
                        <span className="mini-text">{bookName} {currentChapter}:{verses[currentVerseIndex]?.verse}</span>
                    </div>
                )}

                {/* Expanded View */}
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
