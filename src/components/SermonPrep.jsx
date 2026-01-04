import React, { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useNavigate } from 'react-router-dom';
import { getMySermons, createSermon, deleteSermon, generateExegesis, updateSermon, performResearch } from '../services/sermonService';
import { getBooks, getChapter, getChapterCount } from '../services/bibleService';
import { getDeviceFingerprint } from '../utils/security';
import './SermonPrep.css';

const SermonPrep = () => {
    const { settings, user, profile, fetchProfile } = useSettings();
    const navigate = useNavigate();
    const isAf = settings.language === 'af';

    // Workflow State
    const [step, setStep] = useState('dashboard'); // dashboard, foundation, skeleton, laboratory
    const [sermons, setSermons] = useState([]);
    const [currentSermon, setCurrentSermon] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // Foundation Inputs
    const [title, setTitle] = useState('');
    const [mainScripture, setMainScripture] = useState('');
    const [audience, setAudience] = useState('general');
    const [tone, setTone] = useState('balanced');
    const [theme, setTheme] = useState('');
    const [plannedDuration, setPlannedDuration] = useState(30);
    const [isAutoGenerating, setIsAutoGenerating] = useState(false);
    const [autoGenerateProgress, setAutoGenerateProgress] = useState(0);
    const [isGenerating, setIsGenerating] = useState(false);

    // Laboratory & Editor State
    const [activeBlockIndex, setActiveBlockIndex] = useState(0);
    const [isEditingModal, setIsEditingModal] = useState(false);
    const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);
    const [aiQuery, setAiQuery] = useState('');
    const [aiResults, setAiResults] = useState([]);
    const [aiLoading, setAiLoading] = useState(false);
    const [activeLabTab, setActiveLabTab] = useState('research'); // steps, research
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    const [auditReview, setAuditReview] = useState(null); // { analysis: '', suggestions: [], currentIndex: 0 }
    const [showFormattingTips, setShowFormattingTips] = useState(false);
    const [copyModal, setCopyModal] = useState(null); // { content: string } - for iOS manual copy

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (user) {
            loadSermons();
        } else {
            setIsLoading(false);
        }
    }, [user]);

    const loadSermons = async () => {
        setIsLoading(true);
        const result = await getMySermons();
        if (result.success) {
            setSermons(result.sermons);
            // If no sermons exist, go straight to foundation
            if (result.sermons.length === 0) {
                setStep('foundation');
            }
        }
        setIsLoading(false);
    };

    const handleStartNew = () => {
        // Enforce Limit Check BEFORE resetting state
        const remaining = profile?.subscription_tier === 'free' ? 3 - (profile.sermon_trial_count || 0) : 999;

        // Actually, we should check logic based on existing sermons count if we want to be strict about "holding" 3 slots.
        // User request: "create 3 sermons on free account... database will only be able to save on free account 3 sermons"
        // If current count is >= 3, BLOCK.

        // However, the backend is the source of truth. We can try optimistically.
        if (profile?.subscription_tier === 'free' && (profile.sermon_trial_count >= 3 && sermons.length >= 3)) {
            alert(isAf ? 'U het u limiet van 3 gratis preke bereik. Gradeer asseblief op.' : 'You have reached your limit of 3 free sermons. Please upgrade to continue.');
            navigate('/subscription');
            return;
        }

        setCurrentSermon(null);
        setTitle('');
        setMainScripture('');
        setAudience('general');
        setTone('balanced');
        setTheme('');
        setPlannedDuration(90);
        setStep('foundation');
    };

    const handleResumeSermon = (sermon) => {
        setCurrentSermon(sermon);
        setPlannedDuration(sermon.planned_duration || 90);
        setStep(sermon.step || 'skeleton'); // Resume where they left off
    };

    const handleDeleteSermon = async (e, id) => {
        e.stopPropagation();
        if (window.confirm(isAf ? 'Is jy seker jy wil hierdie preek uitvee?' : 'Are you sure you want to delete this sermon?')) {
            const result = await deleteSermon(id);
            if (result.success) {
                loadSermons();
            }
        }
    };

    const handleGenerateSkeleton = async () => {
        if (!title || !mainScripture) {
            alert(isAf ? 'Voer asseblief n titel en skrifgedeelte in.' : 'Please enter a title and scripture passage.');
            return;
        }

        setIsGenerating(true);
        setError(null);
        try {
            const fingerprint = await getDeviceFingerprint();
            const result = await generateExegesis(mainScripture, title, audience, theme, settings.language, plannedDuration, tone);

            if (result.success) {
                // Try to create the sermon record
                const saveResult = await createSermon({
                    title,
                    mainScripture,
                    audience,
                    tone,
                    theme,
                    plannedDuration,
                    blocks: result.data.suggested_blocks
                }, fingerprint);

                if (saveResult.success) {
                    setCurrentSermon(saveResult.sermon);
                    setStep('skeleton');
                    loadSermons();
                    fetchProfile(user.id); // Refresh trial count
                } else if (saveResult.error === 'TRIAL_EXPIRED') {
                    setError('TRIAL_EXPIRED');
                } else {
                    throw new Error(saveResult.error);
                }
            } else {
                alert(result.error);
            }
        } catch (err) {
            console.error(err);
            const errMsg = err.message || (isAf ? 'Onbekende fout' : 'Unknown error');
            alert((isAf ? 'Fout met herwinning van data: ' : 'Error retrieving data: ') + errMsg);
        }
        setIsGenerating(false);
    };

    const handleUpdateBlock = (index, field, value) => {
        if (!currentSermon) return;
        const newBlocks = [...currentSermon.blocks];
        newBlocks[index] = { ...newBlocks[index], [field]: value };

        // Update local state immediately for UI responsiveness
        setCurrentSermon({ ...currentSermon, blocks: newBlocks });
    };

    const saveCurrentSermon = async (targetStep = null) => {
        if (!currentSermon) return { success: false };
        const result = await updateSermon(currentSermon.id, {
            blocks: currentSermon.blocks,
            full_text: currentSermon.full_text || '',
            planned_duration: plannedDuration,
            step: targetStep || currentSermon.step || 'laboratory'
        });
        if (result.success) {
            setCurrentSermon(result.sermon);
        }
        return result;
    };

    const handleSaveSkeleton = async () => {
        setIsLoading(true);
        const result = await updateSermon(currentSermon.id, {
            blocks: currentSermon.blocks,
            planned_duration: plannedDuration,
            step: 'laboratory'
        });

        if (result.success) {
            setCurrentSermon(result.sermon);
            setStep('laboratory');
        }
        setIsLoading(false);
    };

    const handleAutoGenerateBlocks = async () => {
        if (!confirm(isAf ? 'Wil jy inhoud outomaties genereer vir AL die blokke? Dit kan \'n paar oomblikke neem.' : 'Auto-generate content for ALL blocks? This may take a few moments.')) return;

        setIsAutoGenerating(true);
        const total = currentSermon.blocks.length;
        const updatedBlocks = [...currentSermon.blocks];

        for (let i = 0; i < total; i++) {
            setAutoGenerateProgress(i + 1);
            const block = updatedBlocks[i];

            // ALWAYS generate content for each block during batch mode
            const duration = parseInt(block.duration) || 5;
            const targetWords = duration * 135;
            const context = `Sermon: ${currentSermon.title}. Block: ${block.title}. Audience: ${currentSermon.audience}. Style/Tone: ${currentSermon.tone || 'balanced'}. Duration: ${duration} min. STRICT MINIMUM TARGET LENGTH: ${targetWords} spoken words.`;
            const result = await performResearch('suggest_content', block.title, context, settings.language);

            if (result.success) {
                updatedBlocks[i] = { ...block, notes: result.data };
                // Update state incrementally so user sees progress
                setCurrentSermon(prev => ({ ...prev, blocks: [...updatedBlocks] }));

                // Add a small artificial delay so user can see it processing sequentially
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        // Final save to database
        const saveResult = await updateSermon(currentSermon.id, {
            blocks: updatedBlocks,
            planned_duration: plannedDuration,
            step: 'laboratory'
        });
        setIsAutoGenerating(false);

        if (saveResult.success) {
            setCurrentSermon(saveResult.sermon);
            setStep('laboratory');
        } else {
            alert(isAf ? 'Fout met stoor van generasie.' : 'Error saving generation.');
        }
    };

    const handleSaveContent = async (returnToDash = false) => {
        setIsLoading(true);
        const result = await updateSermon(currentSermon.id, {
            blocks: currentSermon.blocks,
            full_text: currentSermon.full_text,
            planned_duration: plannedDuration,
            step: 'laboratory'
        });
        setIsLoading(false);

        if (result.success) {
            setCurrentSermon(result.sermon);
            if (returnToDash) {
                setStep('dashboard');
            } else {
                alert(isAf ? 'Preek vordering gestoor.' : 'Sermon progress saved.');
            }
        } else {
            alert(isAf ? 'Fout met stoor.' : 'Error saving sermon.');
        }
    };

    const handleAssembleScript = () => {
        if (!currentSermon.blocks) return;

        const hasText = currentSermon.full_text && currentSermon.full_text.length > 50;
        if (hasText) {
            if (!confirm(isAf ? "Dit sal jou huidige meesterskrif vervang. Wil jy voortgaan?" : "This will replace your current master script. Do you want to continue?")) {
                return;
            }
        }

        const assembled = currentSermon.blocks.map(b =>
            `## ${b.title}\n\n${b.notes || ''}`
        ).join('\n\n---\n\n');

        setCurrentSermon({ ...currentSermon, full_text: assembled });
    };

    const handlePreachMode = async () => {
        // 1. Build the HTML content (similar to PDF but optimized for screens)
        const sermonTitle = currentSermon.title || (isAf ? 'Preek Konsep' : 'Sermon Draft');

        // Ensure we have text to display, otherwise show a friendly message
        const textToFormat = currentSermon.full_text || (isAf ? 'Geen preek inhoud gevind nie. Gaan terug en genereer eers jou preek.' : 'No sermon content found. Go back and generate your sermon first.');
        // Helper to format text as HTML string (not JSX)
        const formatSermonHtml = (text) => {
            if (!text) return '';

            // Split by newlines to handle paragraphs
            const lines = text.split(/\n+/);

            return lines.map(line => {
                if (!line.trim()) return '';

                // Process internal formatting for each line
                const parts = line.split(/(\(.*?\)|"[^"]*"|(?:\*\*|\*)?\s*Objective:.*?(?:\n|$)|(?:\*\*.*?\*\*))/gi);

                const formattedLine = parts.map(part => {
                    if (!part) return '';
                    if (part.startsWith('(') && part.endsWith(')')) {
                        return `<span class="instruction-text">${part}</span>`;
                    }
                    if (part.startsWith('"') && part.endsWith('"')) {
                        return `<span class="scripture-text">${part}</span>`;
                    }
                    if (part.startsWith('**Objective:')) {
                        return `<span class="objective-text">${part.replace(/\*\*/g, '')}</span>`;
                    }
                    if (part.startsWith('**') && part.endsWith('**')) {
                        return `<span class="highlight-text">${part.replace(/\*\*/g, '')}</span>`;
                    }
                    return part;
                }).join('');

                return `<p class="preach-line">${formattedLine}</p>`;
            }).join('');
        };

        const formattedHtml = formatSermonHtml(textToFormat);

        // 2. Open new window
        const preachWindow = window.open('', '_blank');
        if (!preachWindow) {
            alert(isAf ? 'Laat asseblief opspring-vensters toe.' : 'Please allow popups.');
            return;
        }

        // 3. Inject Preach Mode App
        const htmlContent = `
            <!DOCTYPE html>
            <html lang="${isAf ? 'af' : 'en'}">
            <head>
                <meta charset="UTF-8">
                <link rel="icon" href="data:,">
                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
                <title>🗣️ ${sermonTitle} - Preach Mode</title>
                <style>
                    :root {
                        --bg-color: #ffffff;
                        --text-color: #121212;
                        --highlight-color: #fef9c3;
                        --accent-color: #7c3aed;
                        --font-size: 22px;
                    }
                    @media (prefers-color-scheme: dark) {
                        :root {
                            --bg-color: #121212;
                            --text-color: #e5e5e5;
                            --highlight-color: #3f2e00;
                            --accent-color: #a78bfa;
                        }
                    }
                    body {
                        font-family: sans-serif;
                        line-height: 1.6;
                        color: var(--text-color);
                        background: var(--bg-color);
                        margin: 0;
                        padding: 20px 20px 100px 20px; /* Bottom padding for controls */
                        font-size: var(--font-size);
                        font-weight: bold;
                        max-width: 800px;
                        margin: 0 auto;
                        transition: font-size 0.2s;
                    }
                    h1 { font-size: 1.8em; margin-bottom: 0.5em; text-align: center; color: var(--accent-color); }
                    h2 { font-size: 1.4em; margin-top: 1.5em; border-bottom: 2px solid var(--accent-color); padding-bottom: 5px; }
                    /* Use specific preach-line class for paragraphs */
                    .preach-line, li {
                        padding: 12px;
                        border-radius: 8px;
                        margin-bottom: 8px;
                        cursor: pointer;
                        transition: all 0.2s;
                        user-select: none; /* Prevent text selection for Long Press */
                        -webkit-user-select: none;
                        -webkit-touch-callout: none; /* Prevent iOS Magnifier/Menu */
                        touch-action: manipulation; /* Optimize touch events */
                    }
                    .preach-line:active, li:active { transform: scale(0.99); }
                    .reading-active {
                        background: var(--highlight-color);
                        box-shadow: -4px 0 0 0 var(--accent-color);
                        padding-left: 16px;
                    }
                    .highlight-text { color: #ef4444; font-weight: 800; }
                    .objective-text { color: #dc2626; font-style: italic; border-left: 3px solid #dc2626; padding-left: 10px; opacity: 0.8; font-size: 0.9em; }
                    .scripture-text { color: #2563eb; font-weight: bold; }
                    .instruction-text { color: #ef4444; font-weight: bold; }
                    
                    /* Hide scrollbar for cleaner reading experience */
                    ::-webkit-scrollbar {
                        width: 8px;
                        background: transparent;
                    }
                    ::-webkit-scrollbar-thumb {
                        background: rgba(124, 58, 237, 0.3);
                        border-radius: 4px;
                    }
                    
                    /* Controls Bar */
                    .controls-bar {
                        position: fixed;
                        bottom: 20px;
                        left: 50%;
                        transform: translateX(-50%);
                        background: rgba(30, 30, 30, 0.9);
                        backdrop-filter: blur(10px);
                        padding: 10px 20px;
                        border-radius: 50px;
                        display: flex;
                        gap: 20px;
                        align-items: center;
                        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                        z-index: 1000;
                    }
                    .control-btn {
                        background: transparent;
                        border: 1px solid rgba(255,255,255,0.2);
                        color: white;
                        width: 44px;
                        height: 44px;
                        border-radius: 50%;
                        font-size: 20px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    .close-btn { background: #ef4444; border-color: #ef4444; }
                    .control-btn:active { background: rgba(255,255,255,0.2); }
                    .timer-display {
                        color: white;
                        font-variant-numeric: tabular-nums;
                        font-weight: bold;
                        font-size: 18px;
                        min-width: 60px;
                        text-align: center;
                    }
                </style>
            </head>
            <body>
                <h1>${sermonTitle}</h1>
                <div id="content" class="sermon-content">
                    ${currentSermon.blocks.map(block => `
                        <h2>${block.title}</h2>
                        <div class="block-content">
                            ${formatSermonHtml(block.notes || '')}
                        </div>
                    `).join('')}
                    
                    ${currentSermon.full_text && !currentSermon.blocks.length ? formatSermonHtml(currentSermon.full_text) : ''}
                </div>

                <div class="controls-bar">
                    <button class="control-btn" onclick="adjustFont(-2)">A-</button>
                    <div class="timer-display" id="timer">00:00</div>
                    <button class="control-btn" onclick="adjustFont(2)">A+</button>
                    <button class="control-btn" onclick="toggleTheme()" id="themeBtn">☀️</button>
                    <button class="control-btn" onclick="toggleWakeLock()" id="wakeLockBtn" style="color: #6b7280">🔓</button>
                    <button class="control-btn close-btn" onclick="window.close()">❌</button>
                </div>

                <script>
                    const STORAGE_KEY = 'preach_progress_${currentSermon.id}';
                    const THEME_KEY = 'preach_theme_preference';

                    // 0. Theme Logic
                    let isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    const savedTheme = localStorage.getItem(THEME_KEY);
                    if (savedTheme) {
                        isDark = savedTheme === 'dark';
                    }
                    
                    function applyTheme() {
                        const root = document.documentElement;
                        const btn = document.getElementById('themeBtn');
                        if (isDark) {
                            root.style.setProperty('--bg-color', '#121212');
                            root.style.setProperty('--text-color', '#e5e5e5');
                            root.style.setProperty('--highlight-color', '#3f2e00');
                            root.style.setProperty('--accent-color', '#a78bfa');
                            btn.innerText = '🌙';
                        } else {
                            root.style.setProperty('--bg-color', '#ffffff');
                            root.style.setProperty('--text-color', '#121212');
                            root.style.setProperty('--highlight-color', '#fef9c3');
                            root.style.setProperty('--accent-color', '#7c3aed');
                            btn.innerText = '☀️';
                        }
                    }
                    
                    function toggleTheme() {
                        isDark = !isDark;
                        localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
                        applyTheme();
                    }
                    
                    // Apply initially
                    applyTheme();

                    // Main Initialization
                    window.addEventListener('load', () => {
                        initPreachMode();
                    });

                    function initPreachMode(retryCount = 0) {
                        const lines = document.querySelectorAll('.preach-line, li');
                        
                        if (lines.length === 0) {
                            if (retryCount < 10) {
                                setTimeout(() => initPreachMode(retryCount + 1), 500);
                            }
                            return;
                        }
                        
                        lines.forEach((el, index) => {
                            el.id = 'line-' + index;
                            
                            el.addEventListener('contextmenu', (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                return false;
                            });

                            let pressTimer;
                            let lastTapTime = 0;
                            const LONG_PRESS_DURATION = 800; 
                            const DOUBLE_TAP_DELAY = 300;
                            let isPointerDown = false;

                            // Activate Logic
                            const activateLine = (element) => {
                                document.querySelectorAll('.reading-active').forEach(active => {
                                    if (active !== element) active.classList.remove('reading-active');
                                });
                                if (!element.classList.contains('reading-active')) {
                                    element.classList.add('reading-active');
                                    if (navigator.vibrate) navigator.vibrate(50);
                                    localStorage.setItem(STORAGE_KEY, element.id);
                                }
                                element.style.transform = 'scale(1)';
                                element.style.opacity = '1';
                            };

                            // Deactivate Logic
                            const deactivateLine = (element) => {
                                if (element.classList.contains('reading-active')) {
                                    element.classList.remove('reading-active');
                                    localStorage.removeItem(STORAGE_KEY);
                                }
                            };

                            // POINTER DOWN
                            el.addEventListener('pointerdown', (e) => {
                                if (e.button !== 0) return;
                                
                                isPointerDown = true;
                                el.style.transition = 'transform 0.2s, opacity 0.2s';
                                el.style.transform = 'scale(0.98)';
                                el.style.opacity = '0.7';

                                pressTimer = setTimeout(() => {
                                    if (isPointerDown) {
                                        activateLine(el);
                                        isPointerDown = false; 
                                    }
                                }, LONG_PRESS_DURATION);
                            });

                            // POINTER UP / LEAVE / CANCEL
                            const handlePointerEnd = (e) => {
                                if (isPointerDown) {
                                    el.style.transform = 'scale(1)';
                                    el.style.opacity = '1';
                                    clearTimeout(pressTimer);
                                    isPointerDown = false;
                                    
                                    const currentTime = new Date().getTime();
                                    const tapLength = currentTime - lastTapTime;
                                    
                                    if (tapLength < DOUBLE_TAP_DELAY && tapLength > 0) {
                                        deactivateLine(el);
                                        e.preventDefault();
                                    }
                                    lastTapTime = currentTime;
                                }
                            };

                            el.addEventListener('pointerup', handlePointerEnd);
                            el.addEventListener('pointercancel', handlePointerEnd);
                            el.addEventListener('pointerleave', handlePointerEnd);
                        });

                        // Restore Progress
                        const savedId = localStorage.getItem(STORAGE_KEY);
                        if (savedId) {
                            setTimeout(() => {
                                const savedEl = document.getElementById(savedId);
                                if (savedEl) {
                                    savedEl.classList.add('reading-active');
                                    savedEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }
                            }, 300);
                        }
                    }

                    // 2. Font Size Logic
                    let currentSize = 22;
                    function adjustFont(delta) {
                        currentSize = Math.max(16, Math.min(42, currentSize + delta));
                        document.documentElement.style.setProperty('--font-size', currentSize + 'px');
                    }

                    // 3. Timer Logic
                    let seconds = 0;
                    setInterval(() => {
                        seconds++;
                        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
                        const s = (seconds % 60).toString().padStart(2, '0');
                        document.getElementById('timer').innerText = \`\${m}:\${s}\`;
                    }, 1000);

                    // 4. Wake Lock Logic
                    let wakeLock = null;
                    async function toggleWakeLock() {
                        const btn = document.getElementById('wakeLockBtn');
                        if (!wakeLock) {
                            // Check support silently
                            if ('wakeLock' in navigator) {
                                try {
                                    wakeLock = await navigator.wakeLock.request('screen');
                                    btn.innerText = '🔒';
                                    btn.style.color = '#4ade80'; // Green
                                } catch (err) {
                                    console.log('Wake Lock request failed:', err);
                                    // Fail silently on UI, maybe just keep icon unlocked
                                }
                            } else {
                                console.log('Wake Lock API not supported.');
                            }
                        } else {
                            wakeLock.release();
                            wakeLock = null;
                            btn.innerText = '🔓';
                            btn.style.color = '#6b7280'; // Gray
                        }
                    }
                    
                    // Auto-request with no alert
                    toggleWakeLock();
                </script>
            </body>
            </html>
        `;

        preachWindow.document.write(htmlContent);
        preachWindow.document.close();
    };


    const handleExportPDF = () => {
        if (!currentSermon) return;

        // Create a printable window
        const printWindow = window.open('', '_blank');
        if (!printWindow) return alert('Please allow popups to export PDF');

        // Helper to format text for HTML print
        const formatTextForPrint = (text) => {
            if (!text) return '';

            // Split by regex to find (parentheses), "quotes", or Objective lines (with or without stars)
            // We look for patterns starting with optional stars/space, then "Objective:", then the rest until double newline or end
            const parts = text.split(/(\(.*?\)|"[^"]*"|(?:\*\*|\*)?\s*Objective:.*?(?:\n|$)|(?:\*\*.*?\*\*))/gi);

            return parts.map(part => {
                // Formatting Logic
                if (part && part.startsWith('(') && part.endsWith(')')) {
                    // Instructions
                    const cleanPart = part.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                    return `<span class="instruction-text">${cleanPart}</span>`;
                }
                if (part && part.startsWith('"') && part.endsWith('"')) {
                    // Scripture
                    const cleanPart = part.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                    return `<span class="scripture-text">${cleanPart}</span>`;
                }
                // Check for Objective (case insensitive, looser check)
                if (part && /^(?:\*\*|\*)?\s*Objective:/i.test(part)) {
                    // Objective - render in red
                    const cleanPart = part.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                    return `<span class="objective-text">${cleanPart}</span>`;
                }
                if (part && part.startsWith('**') && part.endsWith('**')) {
                    // Generic Bold -> Red Highlight
                    const cleanPart = part.slice(2, -2).replace(/</g, "&lt;").replace(/>/g, "&gt;");
                    return `<span class="highlight-text">${cleanPart}</span>`;
                }
                // Normal Text - Escape and preserve structure
                return part.replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/\n/g, '<br>');
            }).join('');
        };

        const content = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>${currentSermon.title}</title>
                <style>
                    body { font-family: sans-serif; line-height: 1.6; color: #000; max-width: 800px; margin: 40px auto; padding: 20px; font-weight: bold; }
                    h1 { border-bottom: 2px solid #2563eb; padding-bottom: 10px; margin-bottom: 5px; color: #2563eb; }
                    .meta { color: #2563eb; font-style: italic; margin-bottom: 30px; font-size: 1.25rem; border-bottom: 1px solid #eee; padding-bottom: 10px; }
                    .block { margin-bottom: 25px; page-break-inside: avoid; }
                    .block-title { font-weight: bold; font-size: 1.55rem; margin-bottom: 5px; border-bottom: 1px dotted #ef4444; display: flex; justify-content: space-between; color: #ef4444; }
                    .block-duration { font-size: 1.25rem; font-weight: normal; color: #ef4444; }
                    .block-content { white-space: pre-wrap; font-size: 1.5rem; color: #000; }
                    
                    /* Custom Formatting for PDF */
                    .instruction-text {
                        color: #ef4444 !important; /* Red */
                        font-weight: bold !important;
                    }
                    .scripture-text {
                        color: #2563eb !important; /* Bright Blue */
                        font-weight: bold !important;
                    }
                    .objective-text {
                        color: #ef4444 !important; /* Red */
                        font-weight: bold !important;
                    }
                    .highlight-text {
                         color: #ef4444 !important; /* Red */
                         font-weight: bold !important;
                    }

                    .pdf-nav-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        background: #f8fafc;
                        padding: 15px 20px;
                        border-bottom: 1px solid #e2e8f0;
                        margin: -40px -20px 40px -20px;
                        position: sticky;
                        top: -40px;
                        z-index: 100;
                    }

                    .nav-btn {
                        padding: 10px 18px;
                        border-radius: 8px;
                        font-family: sans-serif;
                        font-weight: 600;
                        font-size: 0.9rem;
                        cursor: pointer;
                        border: none;
                        transition: all 0.2s;
                    }

                    .back-btn { background: #64748b; color: white; }
                    .print-btn { background: #2563eb; color: white; }

                    @page {
                        size: auto;
                        margin: 20mm;
                    }

                    @media print {
                        html, body {
                            height: auto !important;
                            overflow: visible !important;
                            max-width: none !important;
                            width: 100% !important;
                            margin: 0 !important;
                            padding: 0 !important;
                        }
                        body { 
                            -webkit-print-color-adjust: exact; 
                            print-color-adjust: exact; 
                        }
                        .no-print, .pdf-nav-header { display: none !important; }
                        .block { page-break-inside: auto; margin-bottom: 30px; }
                    }
                </style>
            </head>
            <body>
                <div class="pdf-nav-header no-print">
                    <button class="nav-btn back-btn" onclick="window.close()">← ${isAf ? 'Toe & Terug' : 'Close & Back'}</button>
                    <button class="nav-btn print-btn" onclick="window.print()">🖨️ ${isAf ? 'Druk / Stoor PDF' : 'Print / Save PDF'}</button>
                </div>

                <h1>${currentSermon.title}</h1>
                <div class="meta">
                    <strong>Scripture:</strong> ${currentSermon.main_scripture} | 
                    <strong>Audience:</strong> ${currentSermon.audience} | 
                    <strong>Date:</strong> ${new Date().toLocaleDateString()}
                </div>

                ${currentSermon.blocks.map(block => `
                    <div class="block">
                        <div class="block-title">
                            ${block.title}
                            <span class="block-duration">(${block.duration} min)</span>
                        </div>
                        <div class="block-content">${formatTextForPrint(block.notes || '')}</div>
                    </div>
                `).join('')}

                ${currentSermon.full_text ? `
                    <div class="block">
                        <div class="block-title">${isAf ? 'Finale Afronding' : 'Final Polish'}</div>
                        <div class="block-content">${formatTextForPrint(currentSermon.full_text)}</div>
                    </div>
                ` : ''}

                <div class="no-print" style="margin-top: 40px; text-align: center; color: #999; font-size: 0.8rem;">
                    Generated by Bible App Sermon Suite
                </div>
            </body>
            </html>
        `;

        printWindow.document.write(content);
        printWindow.document.close();

        // Wait for styles to load then print
        printWindow.onload = () => {
            printWindow.print();
        };
    };





    const getGeneratedStats = () => {
        if (!currentSermon?.blocks) return { words: 0, estimatedMin: 0 };
        const totalWords = currentSermon.blocks.reduce((acc, block) => {
            const notes = block.notes || '';
            if (notes.trim() === '') return acc;

            // Strip non-spoken content for accurate WPM calculation
            const cleanSpokenText = notes
                .split('\n')
                .filter(line => !line.trim().startsWith('**')) // Strip headers like **Objective:** or **Point 1:**
                .join(' ')
                .replace(/\(.*?\)/g, '') // Strip instructions like (Pause) or (Hold up Bible)
                .trim();

            const words = cleanSpokenText === '' ? 0 : cleanSpokenText.split(/\s+/).filter(w => w.length > 0).length;
            return acc + words;
        }, 0);

        return {
            words: totalWords,
            estimatedMin: Math.round(totalWords / 130)
        };
    };

    const getTotalTime = () => {
        if (!currentSermon?.blocks) return 0;
        return currentSermon.blocks.reduce((acc, block) => acc + (parseInt(block.duration) || 0), 0);
    };

    const rebalanceBlocks = (newTotal) => {
        if (!currentSermon?.blocks || newTotal <= 0) return;

        const currentTotal = getTotalTime();
        if (currentTotal === 0) return;

        const ratio = newTotal / currentTotal;
        const newBlocks = currentSermon.blocks.map(block => {
            let minDuration = 1;
            // Smarter minimums if the total time is reasonable
            if (newTotal >= 20) {
                if (block.title.toLowerCase().includes('inleiding') || block.title.toLowerCase().includes('slot') || block.title.toLowerCase().includes('introduction') || block.title.toLowerCase().includes('conclusion')) {
                    minDuration = 2;
                } else if (block.title.toLowerCase().includes('punt') || block.title.toLowerCase().includes('point')) {
                    minDuration = 3;
                }
            }
            return {
                ...block,
                duration: Math.max(minDuration, Math.round(block.duration * ratio))
            };
        });

        // Handle rounding error to ensure exact sum
        let newSum = newBlocks.reduce((acc, b) => acc + b.duration, 0);
        let diff = newTotal - newSum;

        if (diff !== 0 && newBlocks.length > 0) {
            // Adjust the last block
            newBlocks[newBlocks.length - 1].duration = Math.max(1, newBlocks[newBlocks.length - 1].duration + diff);
        }

        setCurrentSermon({ ...currentSermon, blocks: newBlocks });
    };



    const navigateToBlock = (index) => {
        setActiveBlockIndex(index);
        setStep('block-editor');
        setIsEditingModal(false); // Default to Reader mode
    };

    const formatSermonText = (text) => {
        if (!text) return null;
        // Split by regex to find (parentheses), "quotes", Objective lines, or **bold**
        // Note: Objective line check takes precedence if it matches first
        const parts = text.split(/(\(.*?\)|"[^"]*"|(?:\*\*|\*)?\s*Objective:.*?(?:\n|$)|(?:\*\*.*?\*\*))/gi);

        return parts.map((part, index) => {
            if (part && part.startsWith('(') && part.endsWith(')')) {
                return <span key={index} className="instruction-text">{part}</span>;
            }
            if (part && part.startsWith('"') && part.endsWith('"')) {
                return <span key={index} className="scripture-text">{part}</span>;
            }
            // Objective Line
            if (part && part.startsWith('**Objective:')) {
                return <span key={index} className="objective-text">{part}</span>;
            }
            // Generic Bold
            if (part && part.startsWith('**') && part.endsWith('**')) {
                return <span key={index} className="highlight-text">{part.slice(2, -2)}</span>;
            }
            return part; // Return as is (string)
        });
    };



    // Scripture Picker Logic
    const [showScripturePicker, setShowScripturePicker] = useState(false);
    const [books, setBooks] = useState([]);
    const [pickerState, setPickerState] = useState({ bookId: '', chapter: 1, verseStart: 1, verseEnd: 1 });
    const [maxChapters, setMaxChapters] = useState(150);
    const [pickerLoading, setPickerLoading] = useState(false);

    useEffect(() => {
        if (showScripturePicker) {
            loadBooks();
        }
    }, [showScripturePicker]);

    const loadBooks = async () => {
        const res = await getBooks();
        if (res.success) setBooks(res.data.all);
    };

    const handlePickerChange = async (field, value) => {
        const newState = { ...pickerState, [field]: value };

        if (field === 'bookId') {
            const countRes = await getChapterCount(value);
            if (countRes.success) setMaxChapters(countRes.data);
            newState.chapter = 1; // reset chapter
            newState.verseStart = 1;
            newState.verseEnd = 1;
        }

        setPickerState(newState);
    };

    const handleInsertScripture = async () => {
        setPickerLoading(true);
        // Fetch Chapter
        const res = await getChapter(pickerState.bookId, pickerState.chapter, isAf ? 'AFR53' : 'KJV'); // Default to sensible versions
        if (res.success) {
            // Find verses
            const verses = res.data.filter(v => v.verse >= pickerState.verseStart && v.verse <= pickerState.verseEnd);
            const text = verses.map(v => v.text).join(' ');
            const bookName = books.find(b => b.id === pickerState.bookId)?.name_full || '';
            const reference = `(${bookName} ${pickerState.chapter}: ${pickerState.verseStart}${pickerState.verseEnd > pickerState.verseStart ? '-' + pickerState.verseEnd : ''})`;

            // Format for insertion (Blue Text logic requires "double quotes")
            const formattedInsert = `\n"${text}" ${reference} \n`;

            // Insert at cursor
            insertAtCursor(formattedInsert);
            setShowScripturePicker(false);
        }
        setPickerLoading(false);
    };

    const insertAtCursor = (textToInsert) => {
        const isLab = step === 'laboratory';
        const textarea = isLab
            ? document.querySelector('.manuscript-point.active .manuscript-editor-textarea')
            : document.querySelector('.modal-editor-textarea');

        if (isLab) {
            if (!textarea) return;
            const isFinalPolish = activeBlockIndex === currentSermon.blocks.length;
            const currentText = isFinalPolish ? (currentSermon.full_text || '') : (currentSermon.blocks[activeBlockIndex]?.notes || '');

            const start = textarea.selectionStart || 0;
            const end = textarea.selectionEnd || 0;
            const newText = currentText.substring(0, start) + textToInsert + currentText.substring(end);

            if (isFinalPolish) {
                setCurrentSermon({ ...currentSermon, full_text: newText });
            } else {
                handleUpdateBlock(activeBlockIndex, 'notes', newText);
            }

            setTimeout(() => {
                textarea.focus();
                textarea.setSelectionRange(start + textToInsert.length, start + textToInsert.length);
            }, 50);
        } else {
            const currentBlock = currentSermon.blocks[activeBlockIndex];
            const currentNotes = currentBlock.notes || '';

            if (!isEditingModal || !textarea) {
                setIsEditingModal(true);
                handleUpdateBlock(activeBlockIndex, 'notes', currentNotes + (currentNotes ? '\n' : '') + textToInsert);
                return;
            }

            const start = textarea.selectionStart || 0;
            const end = textarea.selectionEnd || 0;
            const newNotes = currentNotes.substring(0, start) + textToInsert + currentNotes.substring(end);

            handleUpdateBlock(activeBlockIndex, 'notes', newNotes);

            setTimeout(() => {
                textarea.focus();
                textarea.setSelectionRange(start + textToInsert.length, start + textToInsert.length);
            }, 50);
        }
    };

    const renderSkeleton = () => {
        const totalTime = getTotalTime();
        const isOverBudget = Math.ceil(totalTime) > plannedDuration;

        return (
            <div className="skeleton-view">
                <div className="time-budget-header">
                    <div className="time-stat">
                        <span className="time-label">{isAf ? 'Tyd Beplan' : 'Time Planned'}</span>
                        <div className="budget-edit-wrapper">
                            <input
                                type="number"
                                className={`time-value budget-input ${isOverBudget ? 'over-budget' : ''}`}
                                value={plannedDuration}
                                onChange={(e) => setPlannedDuration(parseInt(e.target.value) || 0)}
                                onBlur={(e) => rebalanceBlocks(parseInt(e.target.value) || 0)}
                                onKeyDown={(e) => e.key === 'Enter' && rebalanceBlocks(parseInt(e.target.value) || 0)}
                            />
                            <span className="budget-unit">min</span>
                        </div>
                    </div>

                    <div className="auto-gen-header-stat">
                        <button
                            className={`auto-gen-all-btn ${isAutoGenerating ? 'processing' : ''}`}
                            onClick={handleAutoGenerateBlocks}
                            disabled={isAutoGenerating}
                        >
                            {isAutoGenerating ? (
                                <>
                                    <span className="spinner">⏳</span>
                                    {isAf ? `Besig... (${autoGenerateProgress}/${currentSermon.blocks.length})` : `Processing... (${autoGenerateProgress}/${currentSermon.blocks.length})`}
                                </>
                            ) : (
                                <>✨ {isAf ? 'Outomatiese Generasie' : 'Auto Generate All'}</>
                            )}
                        </button>
                    </div>

                    <div className="time-stat" style={{ textAlign: 'right' }}>
                        <span className="time-label">{isAf ? 'Tyd Oor' : 'Time Left'}</span>
                        <span className="time-value">
                            {plannedDuration - totalTime > 0 ? plannedDuration - totalTime : 0} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>min</span>
                        </span>
                    </div>
                </div>

                <div className="skeleton-layout">
                    {/* PC Sidebar */}
                    <div className="skeleton-info-card hidden-mobile">
                        <h3>ℹ️ {isAf ? 'Preek Detail' : 'Sermon Details'}</h3>
                        <div className="skeleton-info-item">
                            <span>📌</span>
                            <div>
                                <strong>{isAf ? 'Titel:' : 'Title:'}</strong><br />
                                <input
                                    type="text"
                                    className="sermon-detail-title-input"
                                    value={currentSermon.title}
                                    onChange={(e) => setCurrentSermon({ ...currentSermon, title: e.target.value })}
                                    onBlur={() => updateSermon(currentSermon.id, { title: currentSermon.title })}
                                    onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                                />
                            </div>
                        </div>
                        <div className="skeleton-info-item">
                            <span>📖</span>
                            <div>
                                <strong>{isAf ? 'Skrif:' : 'Scripture:'}</strong><br />
                                {currentSermon.main_scripture}
                            </div>
                        </div>
                        <div className="skeleton-info-item">
                            <span>👥</span>
                            <div>
                                <strong>{isAf ? 'Gehoor:' : 'Audience:'}</strong><br />
                                {currentSermon.audience}
                            </div>
                        </div>
                        <div className="skeleton-info-item">
                            <span>🎭</span>
                            <div>
                                <strong>{isAf ? 'Styl / Toon:' : 'Style / Tone:'}</strong><br />
                                <select
                                    className="sermon-detail-tone-select"
                                    value={currentSermon.tone || 'balanced'}
                                    onChange={(e) => {
                                        const newTone = e.target.value;
                                        setCurrentSermon({ ...currentSermon, tone: newTone });
                                        updateSermon(currentSermon.id, { tone: newTone });
                                    }}
                                >
                                    <option value="balanced">{isAf ? 'Gebalanseerd' : 'Balanced'}</option>
                                    <option value="high_energy">{isAf ? 'Dinamies & Hoë Energie' : 'Dynamic & High Energy'}</option>
                                    <option value="compassionate">{isAf ? 'Sag & Deernisvol' : 'Soft & Compassionate'}</option>
                                    <option value="deep">{isAf ? 'Teologies & Diep' : 'Theological & Deep'}</option>
                                    <option value="practical">{isAf ? 'Prakties & Direk' : 'Practical & Punchy'}</option>
                                </select>
                            </div>
                        </div>
                        {currentSermon.theme && (
                            <div className="skeleton-info-item">
                                <span>🎨</span>
                                <div>
                                    <strong>{isAf ? 'Tema:' : 'Theme:'}</strong><br />
                                    {currentSermon.theme}
                                </div>
                            </div>
                        )}
                        <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--border-color)' }}>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                                {isAf
                                    ? 'Klik op enige blok om dit oop te maak en te begin skryf of navorsing te doen.'
                                    : 'Click on any block to open it and start writing or performing research.'}
                            </p>
                        </div>
                    </div>

                    <div className="timeline-container">
                        {currentSermon?.blocks?.map((block, index) => (
                            <div key={index} className="timeline-block" onClick={() => {
                                setActiveBlockIndex(index);
                                setStep('block-editor');
                                setIsEditingModal(false);
                            }}>
                                <div className="block-header">
                                    <span className="block-type">{block.type}</span>
                                    <div className="block-duration-editor">
                                        <input
                                            type="number"
                                            value={block.duration}
                                            onClick={(e) => e.stopPropagation()}
                                            onChange={(e) => handleUpdateBlock(index, 'duration', parseInt(e.target.value))}
                                        />
                                        <span>min</span>
                                    </div>
                                </div>
                                <input
                                    className="block-title-input"
                                    value={block.title}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => handleUpdateBlock(index, 'title', e.target.value)}
                                />
                                <div className="block-preview">{block.notes}</div>

                                {/* Magic Generate Button */}
                                <button
                                    className="magic-generate-btn"
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        if (!confirm(isAf ? 'Wil jy inhoud genereer vir hierdie blok?' : 'Generate content for this block?')) return;

                                        const duration = parseInt(block.duration) || 5;
                                        const targetWords = duration * 135;
                                        const context = `Sermon: ${currentSermon.title}. Block: ${block.title}. Audience: ${currentSermon.audience}. Style/Tone: ${currentSermon.tone || 'balanced'}. Duration: ${duration} min. STRICT MINIMUM TARGET LENGTH: ${targetWords} spoken words.`;
                                        const result = await performResearch('suggest_content', block.title, context, settings.language);

                                        if (result.success) {
                                            handleUpdateBlock(index, 'notes', result.data);
                                        } else {
                                            if (result.error === 'AI_LIMIT_EXCEEDED') {
                                                alert(isAf
                                                    ? 'Gratis AI-limiet bereik (50/50). U kan nie outomaties \'n preek genereer nie.'
                                                    : 'Free AI limit reached (50/50). Please upgrade for unlimited generations.');
                                                navigate('/subscription');
                                            } else {
                                                alert(isAf ? 'Fout met genereer van inhoud.' : 'Error generating content.');
                                            }
                                        }
                                    }}
                                >
                                    ✨ {isAf ? 'Genereer' : 'Generate'}
                                </button>
                            </div>
                        ))}

                        <button className="add-block-btn">
                            + {isAf ? 'Voeg Blok By (Binnekort)' : 'Add Block (Soon)'}
                        </button>
                    </div>
                </div>

                <div className="skeleton-actions">
                    <button className="action-btn secondary" onClick={() => setStep('foundation')}>
                        ← {isAf ? 'Terug' : 'Back'}
                    </button>
                    <button className="action-btn primary" onClick={handleSaveSkeleton}>
                        {isAf ? 'Gaan na Laboratorium' : 'Go to Laboratory'} →
                    </button>
                </div>
            </div >
        );
    };



    const handleRunAiTool = async (tool) => {
        if (!aiQuery) {
            // polish_all and suggest_context don't need aiQuery
            const skipQueryCheck = ['suggest_context', 'polish_all'].includes(tool);
            if (!skipQueryCheck) {
                alert(isAf ? "Tik asseblief 'n soekterm of vraag in." : "Please enter a search term or question.");
                return;
            }
        }

        setAiLoading(true);
        const context = `Sermon Title: ${currentSermon.title}.Block: ${currentSermon.blocks[activeBlockIndex]?.title || 'Final Polish'} `;

        // Detect /bible shortcut and route to bible_verse tool
        let effectiveTool = tool;
        let finalQuery = aiQuery;
        if (aiQuery && aiQuery.toLowerCase().startsWith('/bible')) {
            effectiveTool = 'bible_verse';
            finalQuery = aiQuery.replace(/^\/bible\s*/i, '').trim();
        }

        // Custom logic for polish_all: gather all blocks
        if (effectiveTool === 'polish_all') {
            const allNotes = currentSermon.blocks.map((b, i) => `Point ${i + 1} (${b.title}):\n${b.notes || ''}`).join('\n\n');
            const finalPolish = currentSermon.full_text ? `\n\nFinal Polish:\n${currentSermon.full_text}` : '';

            // Calculate Time Budget
            const totalMinutes = currentSermon.blocks.reduce((acc, b) => acc + (parseInt(b.duration) || 0), 0);
            const targetWords = totalMinutes * 115;
            const timeContext = `\n\nTIME BUDGET: ${totalMinutes} minutes.\nTARGET WORD COUNT: ~${targetWords} words (Aim to maintain this length).`;

            finalQuery = `TITLE: ${currentSermon.title}${timeContext}\n\n${allNotes}${finalPolish}`;
        }


        try {
            const result = await performResearch(effectiveTool, finalQuery, context, settings.language);

            if (result.success) {
                if (effectiveTool === 'polish_all') {
                    try {
                        // Phase 2: Hyper-Robust Extraction
                        let rawData = result.data.trim();
                        let auditData = null;

                        // 1. Remove Markdown noise
                        rawData = rawData.replace(/```json/g, '').replace(/```/g, '').trim();

                        // 2. Locate the core object (ignore trailing AI chatter)
                        const firstBrace = rawData.indexOf('{');
                        const lastBrace = rawData.lastIndexOf('}');

                        if (firstBrace === -1 || lastBrace === -1) {
                            throw new Error('No valid JSON structure ({ }) found in AI response');
                        }

                        let jsonToParse = rawData.substring(firstBrace, lastBrace + 1);

                        try {
                            // pre-clean: Remove invalid single quote escapes specifically
                            const preCleaned = jsonToParse.replace(/\\'/g, "'");

                            // Attempt clean parse first
                            auditData = JSON.parse(preCleaned);
                        } catch (parseErr) {
                            console.warn("Initial parse failed, attempting emergency healing...", parseErr);

                            // 3. Emergency Healing Logic
                            let healed = jsonToParse.trim();

                            // Fix unclosed strings if truncated
                            const quoteCount = (healed.match(/"/g) || []).length;
                            if (quoteCount % 2 !== 0) {
                                // If we have an odd number of quotes, the last one is probably unclosed
                                // Find the last property that might be unclosed
                                if (healed.lastIndexOf('"') > healed.lastIndexOf(':')) {
                                    healed += '"';
                                }
                            }

                            // Ensure it ends with a brace
                            if (!healed.endsWith('}')) healed += '}';

                            try {
                                auditData = JSON.parse(healed);
                            } catch (finalErr) {
                                // 3.5 Final Rescue Attempt: Extreme Auto-Closure
                                console.warn("Standard healing failed, attempting Extreme Rescue...");
                                const rescued = extremeRescueJSON(healed);
                                try {
                                    auditData = JSON.parse(rescued);
                                    console.log("✅ Extreme Rescue Succeeded! Data recovered.");
                                } catch (rescueErr) {
                                    // 4. Advanced Diagnostics: Show exactly where it failed after rescue
                                    const posMatch = rescueErr.message.match(/position (\d+)/);
                                    let diagnostic = "";
                                    if (posMatch) {
                                        const pos = parseInt(posMatch[1]);
                                        const start = Math.max(0, pos - 40);
                                        const end = Math.min(rescued.length, pos + 40);
                                        diagnostic = `\n\nError near: "...${rescued.substring(start, pos)}[ERROR HERE]${rescued.substring(pos, end)}..."`;
                                    }
                                    throw new Error(`Structural JSON Error: ${rescueErr.message}${diagnostic}\n\nHealed Snippet: ${rescued.substring(rescued.length - 100)}`);
                                }
                            }
                        }

                        if (!auditData || !auditData.suggestions) {
                            throw new Error('Audit data received but suggestions list is missing');
                        }

                        setAuditReview({
                            analysis: auditData.analysis || '',
                            suggestions: auditData.suggestions.map(s => ({
                                ...s,
                                original: currentSermon.blocks[s.index]?.notes || '',
                                title: currentSermon.blocks[s.index]?.title || `Point ${s.index + 1}`
                            })),
                            currentIndex: 0
                        });

                        setStep('sermon-audit');
                        setIsAiPanelOpen(false);
                    } catch (err) {
                        console.error('Audit JSON Parse Error:', err, result.data);
                        const snippet = result.data ? result.data.substring(0, 100) : 'EMPTY';
                        alert((isAf ? 'Kon nie oudit data verwerk nie: ' : 'Could not process audit data: ') + err.message + '\n\nData: ' + snippet);
                        setAiResults([{ type: tool, content: result.data, timestamp: new Date() }, ...aiResults]);
                    }
                } else if (effectiveTool === 'verse_search' || effectiveTool === 'bible_verse') {
                    // Try to auto-copy for verse tools
                    try {
                        if (document.execCommand) {
                            const textarea = document.createElement('textarea');
                            textarea.value = result.data;
                            textarea.style.position = 'fixed';
                            textarea.style.left = '-9999px';
                            document.body.appendChild(textarea);
                            textarea.select();
                            document.execCommand('copy');
                            document.body.removeChild(textarea);
                        }
                    } catch (e) { console.log('Auto-copy failed:', e); }
                    setAiResults([{ type: tool, content: result.data, timestamp: new Date(), isAutoCopied: true }, ...aiResults]);
                } else {
                    setAiResults([{ type: tool, content: result.data, timestamp: new Date() }, ...aiResults]);
                }
            } else {
                // Handle Errors
                if (result.error === 'AI_LIMIT_EXCEEDED') {
                    alert(isAf
                        ? 'Gratis AI-limiet bereik (50/50). Gradeer op vir onbeperkte toegang.'
                        : 'Free AI limit reached (50/50). Upgrade for unlimited access or continue manual editing.');
                    navigate('/subscription');
                } else {
                    alert(isAf ? 'Kon nie inhoud genereer nie. Probeer weer.' : 'Could not generate content. Please try again.');
                }
            }
        } catch (err) {
            console.error('Error running AI tool:', err);
            alert(isAf ? 'Fout met AI-instrument: ' + err.message : 'Error with AI tool: ' + err.message);
        }
        setAiLoading(false);
    };

    const copyToClipboard = async (content) => {
        // iOS Safari requires a very specific approach for clipboard access
        const isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

        // iOS: Try Share API first (most reliable on iOS over HTTP)
        if (isiOS && navigator.share) {
            try {
                await navigator.share({ text: content });
                setIsAiPanelOpen(false);
                return; // Share sheet opened successfully
            } catch (shareErr) {
                console.log('Share cancelled or failed:', shareErr);
                // Fall through to other methods
            }
        }

        const fallbackCopy = () => {
            const textarea = document.createElement('textarea');
            textarea.value = content;
            textarea.style.position = 'absolute';
            textarea.style.top = '0';
            textarea.style.left = '0';
            textarea.style.width = '100px';
            textarea.style.height = '100px';
            textarea.style.opacity = '0.01';
            textarea.style.fontSize = '16px';
            textarea.setAttribute('readonly', '');
            document.body.appendChild(textarea);

            if (isiOS) {
                textarea.focus();
                const range = document.createRange();
                range.selectNodeContents(textarea);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
                textarea.setSelectionRange(0, content.length);
            } else {
                textarea.select();
            }

            let success = false;
            try {
                success = document.execCommand('copy');
            } catch (e) {
                console.error('execCommand failed:', e);
            }
            document.body.removeChild(textarea);
            return success;
        };

        // Try modern Clipboard API (works on HTTPS/localhost)
        if (navigator.clipboard && navigator.clipboard.writeText) {
            try {
                await navigator.clipboard.writeText(content);
                alert(isAf ? 'Gekopieer na knipbord!' : 'Copied to clipboard!');
                setIsAiPanelOpen(false);
                return;
            } catch (clipErr) {
                console.log('Clipboard API failed:', clipErr);
            }
        }

        // Fallback: execCommand
        if (fallbackCopy()) {
            alert(isAf ? 'Gekopieer na knipbord!' : 'Copied to clipboard!');
        } else {
            // Last resort: show full-screen modal with selectable text for iOS
            setCopyModal({ content: content });
            return; // Don't close AI panel - modal will handle it
        }
        setIsAiPanelOpen(false);
    };

    const renderBlockEditor = () => {
        const totalTime = getTotalTime();
        const block = currentSermon.blocks[activeBlockIndex];
        if (!block) return null;

        const wordCount = block.notes ? block.notes.trim().split(/\s+/).length : 0;
        const estimatedTime = Math.ceil(wordCount / 130);
        const timeDiff = estimatedTime - block.duration;
        let timeStatus = 'neutral';
        if (timeDiff > 2) timeStatus = 'over';
        if (timeDiff < -2) timeStatus = 'under';

        const handleRegenerate = async () => {
            if (!confirm(isAf ? 'Wil jy die inhoud oor-genereer? Dit sal die huidige teks vervang.' : 'Regenerate content? This will replace current text.')) return;
            setAiLoading(true);
            const duration = parseInt(block.duration) || 5;
            const targetWords = duration * 135;
            const context = `Sermon: ${currentSermon.title}. Block: ${block.title}. Duration: ${duration} min. STRICT MINIMUM TARGET LENGTH: ${targetWords} spoken words.`;
            const result = await performResearch('suggest_content', block.title, context, settings.language);
            if (result.success) {
                handleUpdateBlock(activeBlockIndex, 'notes', result.data);
            }
            setAiLoading(false);
        };

        const handleNext = async () => {
            await updateSermon(currentSermon.id, { blocks: currentSermon.blocks });
            if (activeBlockIndex < currentSermon.blocks.length - 1) {
                setActiveBlockIndex(activeBlockIndex + 1);
                setIsEditingModal(false);
            } else {
                setStep('laboratory');
            }
        };

        const handleBack = () => {
            if (activeBlockIndex > 0) {
                setActiveBlockIndex(activeBlockIndex - 1);
                setIsEditingModal(false);
            } else {
                setStep('skeleton');
            }
        };

        return (
            <div className="block-editor-view">
                <div className="time-budget-header">
                    <div className="title-stat">
                        <input
                            type="text"
                            className="header-sermon-title-input"
                            value={currentSermon.title}
                            onChange={(e) => setCurrentSermon({ ...currentSermon, title: e.target.value })}
                            onBlur={() => updateSermon(currentSermon.id, { title: currentSermon.title })}
                            onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                            placeholder={isAf ? 'Preek Titel' : 'Sermon Title'}
                        />
                    </div>
                    <div className="time-stat">
                        <span className="time-label">{isAf ? 'Tyd Beplan' : 'Time Planned'}</span>
                        <div className="budget-edit-wrapper">
                            <input
                                type="number"
                                className={`time-value budget-input ${totalTime > plannedDuration ? 'over-budget' : ''}`}
                                value={plannedDuration}
                                onChange={(e) => setPlannedDuration(parseInt(e.target.value) || 0)}
                                onBlur={(e) => rebalanceBlocks(parseInt(e.target.value) || 0)}
                                onKeyDown={(e) => e.key === 'Enter' && rebalanceBlocks(parseInt(e.target.value) || 0)}
                            />
                            <span className="budget-unit">min</span>
                        </div>
                    </div>
                    <div className="time-stat" style={{ textAlign: 'right' }}>
                        <span className="time-label">{isAf ? 'Tyd Oor' : 'Time Left'}</span>
                        <span className="time-value">
                            {plannedDuration - totalTime > 0 ? plannedDuration - totalTime : 0} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>min</span>
                        </span>
                    </div>
                </div>

                <div className="editor-top-nav">
                    <button className="nav-btn" onClick={handleBack}>
                        ← {activeBlockIndex === 0 ? (isAf ? 'Raamwerk' : 'Skeleton') : (isAf ? 'Vorige' : 'Previous')}
                    </button>
                    <div className="editor-progress">
                        {isAf ? 'Punt' : 'Point'} {activeBlockIndex + 1} / {currentSermon.blocks.length}
                    </div>
                    <button className="nav-btn primary" onClick={handleNext}>
                        {activeBlockIndex === currentSermon.blocks.length - 1 ? (isAf ? 'Laboratorium' : 'Laboratory') : (isAf ? 'Volgende' : 'Next')} →
                    </button>
                </div>

                <div className="editor-main-card">
                    <div className="block-editor-header">
                        <div className="header-left">
                            <span className="block-badge">{block.type}</span>
                            <h2>{block.title}</h2>
                        </div>
                        <div className="header-actions">
                            <button className="action-btn secondary" onClick={() => setShowScripturePicker(!showScripturePicker)}>
                                📖 {isAf ? 'Bybel' : 'Bible'}
                            </button>
                            <div className={`time-indicator ${timeStatus}`}>
                                ⏱️ {isAf ? 'Geskat:' : 'Est:'} {estimatedTime} min
                                <span className="time-target"> / {block.duration} min</span>
                            </div>
                        </div>
                    </div>

                    {showScripturePicker && (
                        <div className="scripture-picker-panel">
                            <select onChange={(e) => handlePickerChange('bookId', e.target.value)} value={pickerState.bookId} className="picker-select">
                                <option value="">{isAf ? 'Kies Boek' : 'Select Book'}</option>
                                {books.map(b => <option key={b.id} value={b.id}>{b.name_full}</option>)}
                            </select>
                            <div className="picker-inputs">
                                <span>Ch:</span>
                                <input type="number" min="1" max={maxChapters} value={pickerState.chapter} onChange={e => handlePickerChange('chapter', parseInt(e.target.value))} className="picker-input" />
                                <span>V:</span>
                                <input type="number" min="1" value={pickerState.verseStart} onChange={e => handlePickerChange('verseStart', parseInt(e.target.value))} className="picker-input" />
                                <span>-</span>
                                <input type="number" min="1" value={pickerState.verseEnd} onChange={e => handlePickerChange('verseEnd', parseInt(e.target.value))} className="picker-input" />
                            </div>
                            <button className="picker-add-btn" onClick={handleInsertScripture} disabled={pickerLoading}>
                                {pickerLoading ? '...' : (isAf ? 'Voeg by' : 'Add')}
                            </button>
                        </div>
                    )}

                    <div className="formatting-tips-bar">
                        <button className="tips-toggle-btn" onClick={() => setShowFormattingTips(!showFormattingTips)}>
                            💡 {isAf ? 'Formatering Wenke' : 'Formatting Tips'} {showFormattingTips ? '▲' : '▼'}
                        </button>
                        {showFormattingTips && (
                            <div className="tips-content">
                                <span className="tip-item"><span className="red-dot"></span> (Instruksies) = <span style={{ color: '#ef4444', fontWeight: 'bold' }}>Rooi</span></span>
                                <span className="tip-item"><span className="blue-dot"></span> "Skrif" = <span style={{ color: '#2563eb', fontWeight: 'bold' }}>Blou</span></span>
                                <span className="tip-item">Normaal = <span style={{ fontWeight: 'bold' }}>Swart</span></span>
                            </div>
                        )}
                    </div>

                    <div className="block-editor-body" onClick={() => !isEditingModal && setIsEditingModal(true)}>
                        {isEditingModal ? (
                            <textarea
                                className="modal-editor-textarea"
                                value={block.notes || ''}
                                onChange={(e) => handleUpdateBlock(activeBlockIndex, 'notes', e.target.value)}
                                placeholder={isAf ? "Tik jou preek notas hier..." : "Type your sermon notes here..."}
                                autoFocus
                            />
                        ) : (
                            <div className="reader-content">
                                {block.notes ? formatSermonText(block.notes) : (
                                    <span className="placeholder-text">
                                        {isAf ? 'Klik om te begin skryf...' : 'Click to start writing...'}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="block-editor-footer">
                        <div className="footer-left">
                            <button className="action-btn secondary" onClick={() => setIsEditingModal(!isEditingModal)}>
                                {isEditingModal ? (isAf ? '👁️ Lees' : '👁️ Read') : (isAf ? '✏️ Wysig' : '✏️ Edit')}
                            </button>
                            <button className="action-btn secondary" onClick={handleRegenerate} disabled={aiLoading}>
                                {aiLoading ? '...' : '✨ ' + (isAf ? 'Hergenereer' : 'Regenerate')}
                            </button>
                        </div>
                        <button className="action-btn primary" onClick={() => updateSermon(currentSermon.id, { blocks: currentSermon.blocks }).then(() => alert(isAf ? 'Gestoor!' : 'Saved!'))}>
                            💾 {isAf ? 'Stoor' : 'Save'}
                        </button>
                    </div>
                </div >

                {/* Optional: Keep AI Panel access here too if needed, but keeping it simple for now as per request */}
            </div >
        );
    };

    const renderLaboratory = () => {
        const totalTime = getTotalTime();
        // const activeBlock = currentSermon.blocks[activeBlockIndex]; // No longer needed for main editor

        return (
            <div className="laboratory-view">
                <div className="time-budget-header">
                    <div className="title-stat">
                        <input
                            type="text"
                            className="header-sermon-title-input"
                            value={currentSermon.title}
                            onChange={(e) => setCurrentSermon({ ...currentSermon, title: e.target.value })}
                            onBlur={() => updateSermon(currentSermon.id, { title: currentSermon.title })}
                            onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                            placeholder={isAf ? 'Preek Titel' : 'Sermon Title'}
                        />
                    </div>
                    <div className="time-stat">
                        <span className="time-label">{isAf ? 'Tyd Beplan' : 'Time Planned'}</span>
                        <div className="budget-edit-wrapper">
                            <input
                                type="number"
                                className={`time-value budget-input ${totalTime > plannedDuration ? 'over-budget' : ''}`}
                                value={plannedDuration}
                                onChange={(e) => setPlannedDuration(parseInt(e.target.value) || 0)}
                                onBlur={(e) => rebalanceBlocks(parseInt(e.target.value) || 0)}
                                onKeyDown={(e) => e.key === 'Enter' && rebalanceBlocks(parseInt(e.target.value) || 0)}
                            />
                            <span className="budget-unit">min</span>
                        </div>
                    </div>

                    <div className="time-stat stats-dashboard">
                        <span className="time-label">{isAf ? 'Inhoud Analise' : 'Content Analysis'}</span>
                        <div className="stats-values">
                            <span className="stat-main">{getGeneratedStats().estimatedMin} <span className="stat-unit">min</span></span>
                            <span className="stat-sub">{getGeneratedStats().words} {isAf ? 'woorde' : 'words'}</span>
                        </div>
                    </div>

                    <div className="time-stat" style={{ textAlign: 'right' }}>
                        <span className="time-label">{isAf ? 'Tyd Oor' : 'Time Left'}</span>
                        <span className="time-value">
                            {plannedDuration - totalTime > 0 ? plannedDuration - totalTime : 0} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>min</span>
                        </span>
                    </div>
                </div>
                {/* Top Navigation for Blocks */}
                {/* <div className="lab-navigation">
                    {currentSermon.blocks.map((block, idx) => (
                        <button
                            key={idx}
                            className={`lab - nav - item ${idx === activeBlockIndex ? 'active' : ''} `}
                            onClick={() => setActiveBlockIndex(idx)}
                        >
                            {idx + 1}. {block.title}
                        </button>
                    ))}
                </div> */}

                <div className={`lab-container ${isMobile ? `active-${activeLabTab}` : ''}`}>
                    {isMobile && (
                        <div className="lab-mobile-tabs">
                            <button className={`lab-tab-btn ${activeLabTab === 'steps' ? 'active' : ''}`} onClick={() => setActiveLabTab('steps')}>
                                📝 {isAf ? 'Punte' : 'Points'}
                            </button>
                            <button className={`lab-tab-btn ${activeLabTab === 'research' ? 'active' : ''}`} onClick={() => setActiveLabTab('research')}>
                                🔬 {isAf ? 'Navorsing' : 'Reseach'}
                            </button>
                        </div>
                    )}

                    <div className="lab-navigation">
                        <div className="lab-nav-header">
                            <h3>{isAf ? 'Preek Punte' : 'Sermon Points'}</h3>
                        </div>
                        <div className="lab-nav-scroll research-mode">
                            {currentSermon?.blocks?.map((block, index) => (
                                <button
                                    key={index}
                                    className="lab-nav-item"
                                    onClick={() => {
                                        setActiveBlockIndex(index);
                                        setStep('block-editor');
                                        setIsEditingModal(true);
                                    }}
                                >
                                    <span className="nav-item-num">{index + 1}</span>
                                    <div className="nav-item-main">
                                        <span className="nav-item-text">{block.title}</span>
                                        <span className="nav-item-subtext">{isAf ? 'Klik om te skryf' : 'Click to write'}</span>
                                    </div>
                                    <span className="nav-item-time">{block.duration}m</span>
                                </button>
                            ))}
                        </div>
                    </div>



                    {/* AI Panel (Drawer on Mobile, Sidebar on Desktop) */}
                    <div className={`ai-panel ${isAiPanelOpen ? 'open' : ''} ${window.innerWidth >= 1200 ? 'desktop-visible' : ''} `}>
                        <div className="ai-header">
                            <h3>✨ {isAf ? 'AI Navorsing' : 'AI Research'}</h3>
                            <button className="close-ai-btn" onClick={() => setIsAiPanelOpen(false)}>×</button>
                        </div>

                        <>
                            <div className="ai-search-container">
                                <input
                                    type="text"
                                    className="ai-search-input"
                                    placeholder={isAf ? "Wat wil jy navors?" : "What do you want to research?"}
                                    value={aiQuery}
                                    onChange={(e) => setAiQuery(e.target.value)}
                                />
                            </div>

                            <div className="ai-tools-grid">
                                <button className="ai-tool-btn" onClick={() => handleRunAiTool('word_study')}>
                                    <span className="ai-tool-icon">📖</span>
                                    <span className="ai-tool-label">{isAf ? 'Woordstudie' : 'Word Study'}</span>
                                </button>
                                <button className="ai-tool-btn" onClick={() => handleRunAiTool('history')}>
                                    <span className="ai-tool-icon">🏛️</span>
                                    <span className="ai-tool-label">{isAf ? 'Geskiedenis' : 'History'}</span>
                                </button>
                                <button className="ai-tool-btn" onClick={() => handleRunAiTool('commentary')}>
                                    <span className="ai-tool-icon">📚</span>
                                    <span className="ai-tool-label">{isAf ? 'Kommentaar' : 'Commentary'}</span>
                                </button>
                                <button className="ai-tool-btn" onClick={() => handleRunAiTool('illustration')}>
                                    <span className="ai-tool-icon">💡</span>
                                    <span className="ai-tool-label">{isAf ? 'Illustrasie' : 'Illustration'}</span>
                                </button>
                                <button className="ai-tool-btn audit-btn" onClick={() => handleRunAiTool('polish_all')} style={{ gridColumn: 'span 2', background: 'rgba(var(--accent-primary-rgb), 0.1)', borderColor: 'var(--accent-primary)' }}>
                                    <span className="ai-tool-icon">⚖️</span>
                                    <span className="ai-tool-label">{isAf ? 'Oudit Preek' : 'Audit Sermon'}</span>
                                </button>
                            </div>
                        </>

                        <div className="ai-results-area">
                            {aiLoading && <div className="loading-spinner" style={{ width: '24px', height: '24px', margin: '20px auto' }}></div>}

                            {aiResults.map((res, i) => (
                                <div key={i} className="ai-result-card">
                                    <div className="ai-result-type">
                                        {res.type}
                                    </div>
                                    <div className="ai-result-content">{res.content}</div>
                                    <button className="copy-results-btn" onClick={() => copyToClipboard(res.content)}>
                                        📋 {isAf ? 'Kopieer Resultate' : 'Copy Results'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="skeleton-actions laboratory-actions">
                    <button className="action-btn secondary" onClick={() => setStep('skeleton')}>
                        ← {isAf ? 'Raamwerk' : 'Skeleton'}
                    </button>
                    <button className="action-btn secondary save-btn" onClick={() => handleSaveContent(false)}>
                        💾 {isAf ? 'Stoor' : 'Save'}
                    </button>
                    <button className="action-btn secondary pdf-btn" onClick={handleExportPDF}>
                        📄 {isAf ? 'PDF' : 'PDF'}
                    </button>
                    <button className="action-btn secondary pdf-btn" onClick={handlePreachMode} style={{ borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)' }}>
                        🗣️ {isAf ? 'Preek Modus' : 'Preach Mode'}
                    </button>
                    <button className="action-btn primary done-btn" onClick={() => handleSaveContent(true)}>
                        ✅ {isAf ? 'Klaar' : 'Done'}
                    </button>
                </div>
            </div>
        );
    };

    const renderAuthGate = () => (
        <div className="gate-container auth-gate">
            <div className="gate-card">
                <div className="gate-icon">🔐</div>
                <h2>{isAf ? 'Toegang Beperk' : 'Access Restricted'}</h2>
                <p>
                    {isAf
                        ? 'Slegs geregistreerde lede met \'n e-pos adres kan die Preek Suite gebruik.'
                        : 'Only registered members with an email address can use the Sermon Suite.'}
                </p>
                <button className="gate-btn primary" onClick={() => navigate('/profile')}>
                    {isAf ? 'Teken In / Registreer' : 'Sign In / Register'}
                </button>
            </div>
        </div>
    );

    const renderTrialGate = () => (
        <div className="gate-container trial-gate">
            <div className="gate-card premium">
                <div className="gate-badge">PRO FEATURE</div>
                <div className="gate-icon">✨</div>
                <h2>{isAf ? 'Gratis Proeftyd Verstreke' : 'Free Trial Expired'}</h2>
                <p>
                    {isAf
                        ? 'Jy het reeds jou 3 gratis preke gebou. Gradeer op na Pro vir onbeperkte toegang!'
                        : 'You have already built your 3 free sermons. Upgrade to Pro for unlimited access!'}
                </p>
                <div className="premium-features">
                    <span>✅ {isAf ? 'Onbeperkte AI Analise' : 'Unlimited AI Analysis'}</span>
                    <span>✅ {isAf ? 'Gevorderde Navorsingsgereedskap' : 'Advanced Research Tools'}</span>
                    <span>✅ {isAf ? 'PDF Uitvoer & Druk' : 'PDF Export & Print'}</span>
                </div>
                <button className="gate-btn premium-btn">
                    {isAf ? 'Gradeer nou op' : 'Upgrade Now'}
                </button>
                <button className="gate-btn secondary" onClick={() => { setStep('dashboard'); setError(null); }}>
                    {isAf ? 'Terug na Paneel' : 'Back to Dashboard'}
                </button>
            </div>
        </div>
    );

    const renderDashboard = () => (
        <div className="dashboard-view">
            <div className="dashboard-header-row">
                <div>
                    <h2>{isAf ? 'My Preke' : 'My Sermons'}</h2>
                    {profile && profile.subscription_tier === 'free' && (
                        <div className="trial-counter">
                            {isAf ? 'Gratis Preke oor:' : 'Free Trials left:'}
                            <span className={3 - profile.sermon_trial_count <= 1 ? 'critical' : ''}>
                                {Math.max(0, 3 - profile.sermon_trial_count)} / 3
                            </span>
                        </div>
                    )}
                </div>
                <button className="new-sermon-btn" onClick={handleStartNew}>
                    + {isAf ? 'Nuwe Preek' : 'New Sermon'}
                </button>
            </div>

            {isLoading ? (
                <div className="loading-spinner"></div>
            ) : (
                <div className="sermon-grid">
                    {sermons.map(sermon => (
                        <div key={sermon.id} className="sermon-card" onClick={() => handleResumeSermon(sermon)}>
                            <div className="sermon-card-header">
                                <h3>{sermon.title}</h3>
                                <button className="delete-icon-btn" onClick={(e) => handleDeleteSermon(e, sermon.id)}>🗑️</button>
                            </div>
                            <div className="sermon-meta">
                                <span>📖 {sermon.main_scripture}</span>
                                <span>📅 {new Date(sermon.updated_at).toLocaleDateString()}</span>
                            </div>
                            <div className="progress-bar">
                                <div
                                    className="progress-fill"
                                    style={{
                                        width: sermon.step === 'laboratory' ? '80%' :
                                            sermon.step === 'skeleton' ? '40%' : '10%'
                                    }}
                                ></div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );


    const renderSermonAudit = () => {
        if (!auditReview || !currentSermon) return null;
        const currentSuggestion = auditReview.suggestions[auditReview.currentIndex];

        // Safety check: Ensure the index is valid
        if (!currentSuggestion) return null;

        return (
            <div className="sermon-audit-page">
                <div className="audit-header">
                    <div className="audit-header-content">
                        <h2>⚖️ {isAf ? 'Preek Oudit & Polering' : 'Sermon Audit & Polish'}</h2>
                        <p className="sermon-title-sub">{currentSermon.title}</p>
                    </div>
                    <button className="exit-audit-btn" onClick={async () => {
                        await saveCurrentSermon();
                        setAuditReview(null);
                        setStep('laboratory');
                    }}>
                        ✕ {isAf ? 'Sluit Oudit' : 'Close Audit'}
                    </button>
                </div>

                <div className="audit-stepper">
                    {auditReview.suggestions.map((_, idx) => (
                        <div key={idx} className={`audit-step-dot ${idx === auditReview.currentIndex ? 'active' : ''} ${idx < auditReview.currentIndex ? 'completed' : ''}`}></div>
                    ))}
                </div>

                <div className="audit-content-layout">
                    <div className="audit-main-area">
                        {auditReview.currentIndex === 0 && (
                            <div className="audit-info-card">
                                <div className="analysis-summary">
                                    <h3>{isAf ? 'Oudit Analise' : 'Audit Analysis'}</h3>
                                    <p>{auditReview.analysis}</p>
                                </div>
                            </div>
                        )}

                        <div className="suggestion-container active">
                            <div className="suggestion-meta">
                                <span className="point-badge">{isAf ? 'Punt' : 'Point'} {currentSuggestion.index + 1}</span>
                                <h3 className="point-title">{currentSuggestion.title}</h3>
                            </div>

                            <div className="reason-banner">
                                <span className="reason-icon">💡</span>
                                <div className="reason-text">
                                    <strong>{isAf ? 'Hoekom hierdie verandering?' : 'Why this change?'}</strong>
                                    <p>{currentSuggestion.reason}</p>
                                </div>
                            </div>

                            <div className="comparison-grid">
                                <div className="comparison-card original">
                                    <div className="card-label">{isAf ? 'HUIDIGE TEKS' : 'CURRENT TEXT'}</div>
                                    <div className="card-body">{currentSuggestion.original}</div>
                                </div>
                                <div className="comparison-card suggested">
                                    <div className="card-label">{isAf ? 'VOORGESTELDE TEKS' : 'SUGGESTED TEXT'}</div>
                                    <div className="card-body">{currentSuggestion.suggested}</div>
                                </div>
                            </div>

                            <div className="audit-nav-actions">
                                <button
                                    className="audit-btn reject"
                                    onClick={() => {
                                        if (auditReview.currentIndex + 1 >= auditReview.suggestions.length) {
                                            setAuditReview(null);
                                            setStep('laboratory');
                                        } else {
                                            setAuditReview({ ...auditReview, currentIndex: auditReview.currentIndex + 1 });
                                        }
                                    }}
                                >
                                    ❌ {isAf ? 'Ignoreer & Volgende' : 'Ignore & Next'}
                                </button>
                                <button
                                    className="audit-btn accept"
                                    onClick={async () => {
                                        handleUpdateBlock(currentSuggestion.index, 'notes', currentSuggestion.suggested);
                                        if (auditReview.currentIndex + 1 >= auditReview.suggestions.length) {
                                            await saveCurrentSermon();
                                            setAuditReview(null);
                                            setStep('laboratory');
                                            alert(isAf ? 'Alle veranderinge voltooi en gestoor!' : 'All changes applied and saved!');
                                        } else {
                                            setAuditReview({ ...auditReview, currentIndex: auditReview.currentIndex + 1 });
                                        }
                                    }}
                                >
                                    ✅ {isAf ? 'Pas Toe & Volgende' : 'Apply & Next'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderFoundation = () => (
        <div className="foundation-stage">
            <div className="input-card">
                <div className="input-group">
                    <label>
                        {isAf ? 'Preek Titel' : 'Sermon Title'}
                        <span style={{ color: 'red' }}>*</span>
                    </label>
                    <input
                        type="text"
                        placeholder={isAf ? 'bv. Die Verlore Seun' : 'e.g. The Prodigal Son'}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />
                </div>

                <div className="input-group">
                    <label>
                        {isAf ? 'Hoof Skrifgedeelte(s)' : 'Main Scripture Passage(s)'}
                        <span className="ai-badge">AI Analysis</span>
                        <span style={{ color: 'red' }}>*</span>
                    </label>
                    <input
                        type="text"
                        placeholder={isAf ? 'bv. Joh 3:16, Ps 23, Romeine 8' : 'e.g. John 3:16, Ps 23, Romans 8'}
                        value={mainScripture}
                        onChange={(e) => setMainScripture(e.target.value)}
                    />
                    <p className="helper-text">
                        {isAf
                            ? 'Jy kan veelvuldige verse skei met , . / of |'
                            : 'You can list multiple verses separated by , . / or |'}
                    </p>
                </div>

                <div className="input-group">
                    <label>{isAf ? 'Teiken Gehoor' : 'Target Audience'}</label>
                    <select value={audience} onChange={(e) => setAudience(e.target.value)}>
                        <option value="general">{isAf ? 'Algemene Gemeente' : 'General Congregation'}</option>
                        <option value="youth">{isAf ? 'Jeug / Tieners' : 'Youth / Teens'}</option>
                        <option value="new_believers">{isAf ? 'Nuwe Gelowiges' : 'New Believers'}</option>
                        <option value="mature">{isAf ? 'Volwasse Gelowiges' : 'Mature Believers'}</option>
                        <option value="outreach">{isAf ? 'Buitekerklike / Evangelisasie' : 'Outreach / Evangelism'}</option>
                    </select>
                </div>

                <div className="input-group">
                    <label>{isAf ? 'Styl / Toon' : 'Style / Tone'}</label>
                    <select value={tone} onChange={(e) => setTone(e.target.value)}>
                        <option value="balanced">{isAf ? 'Gebalanseerd' : 'Balanced'}</option>
                        <option value="high_energy">{isAf ? 'Dinamies & Hoë Energie' : 'Dynamic & High Energy'}</option>
                        <option value="compassionate">{isAf ? 'Sag & Deernisvol' : 'Soft & Compassionate'}</option>
                        <option value="deep">{isAf ? 'Teologies & Diep' : 'Theological & Deep'}</option>
                        <option value="practical">{isAf ? 'Prakties & Direk' : 'Practical & Punchy'}</option>
                    </select>
                </div>

                <div className="input-group">
                    <label>{isAf ? 'Beplande Tyd (Minute)' : 'Planned Duration (Minutes)'}</label>
                    <input
                        type="number"
                        min="5"
                        max="240"
                        value={plannedDuration}
                        onChange={(e) => setPlannedDuration(parseInt(e.target.value) || 0)}
                    />
                    <p className="helper-text">
                        {isAf ? 'Kies die totale teiken tyd vir jou preek.' : 'Choose the total target duration for your sermon.'}
                    </p>
                </div>

                <div className="input-group">
                    <label>{isAf ? 'Sentrale Tema (Opsioneel)' : 'Central Theme (Optional)'}</label>
                    <input
                        type="text"
                        placeholder={isAf ? 'bv. God se onvoorwaardelike liefde' : 'e.g. God\'s unconditional love'}
                        value={theme}
                        onChange={(e) => setTheme(e.target.value)}
                    />
                </div>

                <button
                    className="start-btn"
                    onClick={handleGenerateSkeleton}
                    disabled={!title || !mainScripture || isGenerating}
                >
                    {isGenerating ? (
                        <>✨ {isAf ? 'Besig om te Analiseer...' : 'Analyzing Scripture...'}</>
                    ) : (
                        <>{isAf ? 'Begin Preekbou' : 'Start Building Sermon'} →</>
                    )}
                </button>
            </div>

            {/* Desktop Preview Side (Hidden on Mobile) */}
            <div className="foundation-preview-side hidden-mobile">
                <div>
                    <h3>🚀 {isAf ? 'Die Preekbouer' : 'The Sermon Builder'}</h3>
                    <p style={{ marginTop: '16px', lineHeight: '1.6' }}>
                        {isAf
                            ? 'Begin deur die fondasie te lê. Ons sal die teks analiseer en jou help om \'n sterk raamwerk te bou.'
                            : 'Start by laying the foundation. We will analyze the text and help you build a strong framework.'}
                    </p>
                    <div className="step-indicators" style={{ marginTop: '40px', display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--accent-primary)' }}></div>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--bg-primary)', border: '2px solid var(--border-color)' }}></div>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--bg-primary)', border: '2px solid var(--border-color)' }}></div>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--bg-primary)', border: '2px solid var(--border-color)' }}></div>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="sermon-prep-container">
            {!user ? renderAuthGate() : (
                <>
                    {error === 'TRIAL_EXPIRED' ? renderTrialGate() : (
                        <>
                            {step !== 'dashboard' && (
                                <div className="step-nav">
                                    <button className="back-to-dash" onClick={() => setStep('dashboard')}>
                                        ← {isAf ? 'Paneel' : 'Dashboard'}
                                    </button>
                                    <div className="step-dots">
                                        <div className={`step-dot ${step === 'foundation' ? 'active' : ''}`}></div>
                                        <div className={`step-dot ${step === 'skeleton' ? 'active' : ''}`}></div>
                                        <div className={`step-dot ${step === 'laboratory' ? 'active' : ''}`}></div>
                                    </div>
                                </div>
                            )}

                            {isLoading ? (
                                <div className="loading-spinner-container">
                                    <div className="loading-spinner"></div>
                                </div>
                            ) : (
                                <>
                                    {step === 'dashboard' && renderDashboard()}
                                    {step === 'foundation' && renderFoundation()}
                                    {step === 'skeleton' && renderSkeleton()}
                                    {step === 'block-editor' && renderBlockEditor()}
                                    {step === 'laboratory' && renderLaboratory()}
                                    {step === 'sermon-audit' && renderSermonAudit()}
                                </>
                            )}
                        </>
                    )}
                </>
            )}

            {/* iOS Copy Modal - for when clipboard APIs fail */}
            {copyModal && (
                <div className="copy-modal-overlay" onClick={() => { setCopyModal(null); setIsAiPanelOpen(false); }}>
                    <div className="copy-modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>{isAf ? '📋 Kopieer Teks Handmatig' : '📋 Copy Text Manually'}</h3>
                        <p style={{ marginBottom: '12px', color: 'var(--text-secondary)' }}>
                            {isAf
                                ? 'Hou die teks lank ingedruk → Kies Alles → Kopieer'
                                : 'Long-press the text → Select All → Copy'}
                        </p>
                        <textarea
                            className="copy-modal-textarea"
                            value={copyModal.content}
                            readOnly
                            onClick={(e) => e.target.select()}
                            style={{
                                width: '100%',
                                height: '300px',
                                padding: '16px',
                                fontSize: '16px',
                                border: '2px solid var(--accent-primary)',
                                borderRadius: '12px',
                                resize: 'none',
                                fontFamily: 'inherit'
                            }}
                        />
                        <button
                            className="copy-modal-close-btn"
                            onClick={() => { setCopyModal(null); setIsAiPanelOpen(false); }}
                            style={{
                                marginTop: '16px',
                                padding: '12px 24px',
                                background: 'var(--accent-primary)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '16px',
                                cursor: 'pointer'
                            }}
                        >
                            {isAf ? 'Sluit' : 'Close'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SermonPrep;

// Utility to rescue truncated or malformed JSON by auto-closing objects/arrays
// AND escaping internal quotes that would break JSON.parse
function extremeRescueJSON(str) {
    let stack = [];
    let inString = false;
    let isEscaped = false;
    let result = "";
    let cleanStr = str.trim();

    for (let i = 0; i < cleanStr.length; i++) {
        const char = cleanStr[i];

        if (inString) {
            if (isEscaped) {
                result += char;
                isEscaped = false;
            } else if (char === '\\') {
                // Peek ahead check for invalid escapes
                const nextChar = cleanStr[i + 1];
                const validEscapes = ['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u'];

                if (!validEscapes.includes(nextChar)) {
                    // INVALID JSON ESCAPE DETECTED (e.g. \B, \', \space)
                    // Treat the backslash as noise and ignore it.
                    continue;
                }

                result += char;
                isEscaped = true;
            } else if (char === '"') {
                // Peek ahead to see if this quote is likely ending the string
                // Strings in our JSON are usually followed by , " or } or ] or :
                const remaining = cleanStr.slice(i + 1).trim();
                const nextChar = remaining[0];

                // If it's a quote followed by a delimiter, it's a string end
                if (nextChar === ',' || nextChar === '}' || nextChar === ']' || nextChar === ':') {
                    result += char;
                    inString = false;
                } else if (remaining === "") {
                    // End of string at end of input
                    result += char;
                    inString = false;
                } else {
                    // It's an internal quote! Escape it.
                    result += '\\"';
                }
            } else {
                // Escape literal control characters that break JSON.parse
                if (char === '\n') result += '\\n';
                else if (char === '\r') result += '\\r';
                else if (char === '\t') result += '\\t';
                else result += char;
            }
        } else {
            result += char;
            if (char === '"') {
                inString = true;
            } else if (char === '{') {
                stack.push('}');
            } else if (char === '[') {
                stack.push(']');
            } else if (char === '}') {
                if (stack.length > 0 && stack[stack.length - 1] === '}') {
                    stack.pop();
                }
            } else if (char === ']') {
                if (stack.length > 0 && stack[stack.length - 1] === ']') {
                    stack.pop();
                }
            }
        }
    }

    if (inString) {
        result += '"';
    }

    // Close remaining structures
    while (stack.length > 0) {
        let closing = stack.pop();
        result = result.trim().replace(/,\s*$/, "");
        result += closing;
    }

    return result;
}
