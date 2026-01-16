import React, { useState, useEffect, useRef } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useNavigate } from 'react-router-dom';
import { getMySermons, createSermon, deleteSermon, generateExegesis, updateSermon, performResearch, incrementSermonAuditCount } from '../services/sermonService';
import { getBooks, getChapter, getChapterCount } from '../services/bibleService';
import { askBibleQuestion } from '../services/aiService';
import { getDeviceFingerprint } from '../utils/security';
import './SermonPrep.css';
import TutorialOverlay from './TutorialOverlay';

// --- pure helper functions ---
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

const scrubText = (text, blockTitle, mainSermonTitle) => {
    if (!text) return '';
    // Match (Instructions), Objective: ..., and **Highlights**
    const redTextRegex = /(\(.*?\)|(?:\*\*|\*)?\s*Objective:.*?(?:\n|$)|(?:\*\*.*?\*\*))/gi;

    let scrubbed = text.replace(redTextRegex, '');

    // Clean title for comparison (remove "Point X:", "Punt X:", and punctuation)
    const getComparisonText = (t) => t.toLowerCase()
        .replace(/^(?:point|punt)\s*\d+\s*[:\)]\s*/gi, '')
        .replace(/[^\w\s]/g, '')
        .trim();

    const cleanBlockTitle = getComparisonText(blockTitle || '');
    const cleanSermonTitle = getComparisonText(mainSermonTitle || '');

    // 2. TTS Optimization (Pauses)
    const lines = scrubbed.split('\n');
    let resultLines = lines.map(line => {
        let l = line.trim();
        if (!l) return null;

        // Remove redundant Point/Header labels AND their trailing content if it's just a header
        // e.g. "POINT 1: THE PROBLEM OF FEAR" -> might want to keep "THE PROBLEM OF FEAR" 
        // OR might want to remove it if it duplicates the block title. 
        // For now, we strip the label "POINT 1:" and let the dedup logic handle the rest.
        l = l.replace(/^(?:Point|Punt|Application|Toepassing|Conclusion|Slot|Introduction|Inleiding)\s*\d*\s*[:\)]\s*/gi, '');
        l = l.replace(/^\d+\.\s*/, '');

        // Remove standalone colons or residue punctuation lines
        if (l === ':' || l === '.' || l === '):') return null;

        // Remove any remaining markdown markers (including backticks and dollars that break template literals)
        l = l.replace(/[#*_-`$]/g, '').trim();
        if (!l) return null;

        // Deduplicate if this line is just the title again (Block Title OR Sermon Title)
        const cmpLine = getComparisonText(l);
        if ((cleanBlockTitle && cmpLine === cleanBlockTitle) ||
            (cleanSermonTitle && cmpLine === cleanSermonTitle)) {
            return null;
        }

        // Add emotional/pause markers for MAJOR punctuation only
        // Handle trailing quotes/brackets: . ... or ." ... or .) ...
        let processed = l.replace(/([.?!;])(["'”’)]?)(?:\s+|$)/g, '$1$2 ... ');

        // Final cleanup: remove redundant dots/pauses like "... ." or "... . ..."
        return processed.replace(/\.\.\.\s*\.\s*(\.\.\.)?/g, '... ')
            .replace(/\.\s+\.\.\./g, ' ...')
            .trim();
    }).filter(l => l !== null);

    return resultLines.join('\n\n');
};

const SermonPrep = () => {
    const { settings, user, profile, fetchProfile } = useSettings();
    const navigate = useNavigate();
    const isAf = settings.language === 'af';
    const isAdmin = profile?.subscription_override === 'admin';
    const isFingerUser = user?.email?.toLowerCase().includes('finger') || profile?.subscription_override === 'tester_finger';
    const canSeeExperimental = isAdmin || profile?.subscription_override === 'tester' || user?.email === 'Andre@58078' || isFingerUser;

    const isPremium = profile?.subscription_override === 'premium' || (profile?.subscription_expiry && new Date(profile.subscription_expiry) > new Date());
    const canAccessPremium = isAdmin || isPremium;

    // Audit Quota Logic
    const isTester = profile?.subscription_override === 'tester' || profile?.subscription_override === 'tester_finger' || isFingerUser;
    const auditLimit = isTester ? 10 : 3;
    const auditCount = parseInt(profile?.sermon_audit_count || 0, 10);
    const canAccessAudit = !!profile && (canAccessPremium || auditCount < auditLimit);

    // Premium Feature Descriptions
    const premiumFeatures = {
        podcast: {
            name: isAf ? 'Podgooi Skrip' : 'Podcast Script',
            desc: isAf ? 'Genereer \'n volledige podgooi-styl skrip met \'n aanbieder en kenner.' : 'Generate a full podcast-style script with a host and expert.'
        },
        narrator: {
            name: isAf ? 'Verteller Skrip' : 'Narrator Script',
            desc: isAf ? 'Genereer \'n vloeibare vertelling van jou preek vir oudio.' : 'Generate a fluid narrative of your sermon for audio.'
        },
        tts: {
            name: isAf ? 'TTS Oudio' : 'TTS Audio',
            desc: isAf ? 'Luister na jou preek met standaard KI-stemme.' : 'Listen to your sermon with AI standard voices.'
        },
        preach: {
            name: isAf ? 'Preek Modus' : 'Preach Mode',
            desc: isAf ? 'fokus-modus vir die kansel met groot teks en \'n horlosie.' : 'Focus mode for the pulpit with large text and a timer.'
        },
        audit: {
            name: isAf ? 'Oudit Preek' : 'Audit Sermon',
            desc: isAf ? (isTester ? `Jy het ${auditCount}/10 oudits gebruik.` : `Jy het ${auditCount}/3 gratis oudits gebruik.`) : (isTester ? `You've used ${auditCount}/10 audits.` : `You've used ${auditCount}/3 free audits.`)
        }
    };

    const handlePremiumLockClick = (featureKey) => {
        const feat = premiumFeatures[featureKey];
        const msg = isAf
            ? `${feat.name}: ${feat.desc}\n\nHierdie is 'n PRO funksie. Wil jy inteken om toegang te kry?`
            : `${feat.name}: ${feat.desc}\n\nThis is a PRO feature. Would you like to subscribe to get access?`;

        if (window.confirm(msg)) {
            navigate('/subscription');
        }
    };

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
    const [isSuggestingVerses, setIsSuggestingVerses] = useState(false);

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
    const [scriptCopyNote, setScriptCopyNote] = useState(null); // { type: string }
    const [isTutorialOpen, setIsTutorialOpen] = useState(false);
    const [isTutorialMode, setIsTutorialMode] = useState(false);
    const [tutorialStepIdx, setTutorialStepIdx] = useState(0);

    // v12.6: Mobile-Friendly Overlay State (Bypasses Popup Blockers)
    const [overlayState, setOverlayState] = useState({ isOpen: false, content: '', title: '', controlsType: null });

    // v12.6: Message Listener for Iframe Actions (Mobile Wake Lock / Clipboard)
    useEffect(() => {
        const handleMessage = async (event) => {
            if (!event.data || !event.data.type) return;

            // 1. Handle Wake Lock Request
            if (event.data.type === 'WAKELOCK_TOGGLE') {
                try {
                    // We toggle screen wake lock from main thread
                    if ('wakeLock' in navigator) {
                        try {
                            const lock = await navigator.wakeLock.request('screen');
                            // Send success back to all iframes (simplest way to hit the overlay)
                            const iframes = document.querySelectorAll('iframe');
                            iframes.forEach(f => f.contentWindow.postMessage({ type: 'WAKELOCK_ACTIVE' }, '*'));
                        } catch (err) {
                            console.error('Main Thread Lock Error:', err);
                            const iframes = document.querySelectorAll('iframe');
                            iframes.forEach(f => f.contentWindow.postMessage({ type: 'WAKELOCK_ERROR' }, '*'));
                        }
                    }
                } catch (e) { console.error(e); }
            }

            // 2. Handle Clipboard Request
            if (event.data.type === 'COPY_TEXT') {
                try {
                    await navigator.clipboard.writeText(event.data.text);
                    const iframes = document.querySelectorAll('iframe');
                    iframes.forEach(f => f.contentWindow.postMessage({ type: 'COPY_SUCCESS' }, '*'));
                } catch (err) {
                    console.error('Clipboard Error:', err);
                }
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    // v12.6: Toggle Body Class for Overlay
    useEffect(() => {
        if (overlayState.isOpen) {
            document.body.classList.add('overlay-open');
        } else {
            document.body.classList.remove('overlay-open');
        }
        return () => document.body.classList.remove('overlay-open');
    }, [overlayState.isOpen]);

    const tutorialSteps = [
        {
            target: '#tutorial-new-sermon',
            title: isAf ? 'Begin Hier' : 'Start Here',
            content: isAf
                ? 'Klik hier om jou eerste preek te skep. Dit is die begin van jou reis.'
                : 'Click here to create your first sermon. This is the start of your journey.'
        },
        {
            target: '#tutorial-foundation-title',
            title: isAf ? 'Die Tema' : 'The Title',
            content: isAf
                ? 'Gee jou preek \'n kragtige titel. Die AI gebruik dit om die res van die inhoud te rig.'
                : 'Give your sermon a powerful title. The AI uses this to guide the rest of the content.'
        },
        {
            target: '#tutorial-foundation-scripture',
            title: isAf ? 'Die Woord' : 'The Scripture',
            content: isAf
                ? 'Voer die hoofverse in. Ons AI kan selfs verse voorstel as jy vashaak!'
                : 'Enter the main scriptures. Our AI can even suggest verses if you get stuck!'
        },
        {
            target: '#tutorial-start-building',
            title: isAf ? 'Laat die AI help' : 'Let AI help',
            content: isAf
                ? 'Sodra jy gereed is, klik hier. Die AI sal die teks analiseer en \'n volledige raamwerk skep.'
                : 'Once you are ready, click here. The AI will analyze the text and create a complete framework.'
        }
    ];

    useEffect(() => {
        // Auto-open tutorial for new users who have 0 sermons
        // Only check AFTER sermons have finished loading to avoid false positive
        if (!isLoading && sermons.length === 0 && !localStorage.getItem('sermon_tutorial_completed')) {
            setTimeout(() => {
                setIsTutorialMode(true);
                setIsTutorialOpen(true);
            }, 1500);
        }
    }, [sermons, isLoading]);

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
        // Enforce Limit Check using unified logic
        const isPremiumTier = profile?.subscription_override === 'premium' ||
            (profile?.subscription_expiry && new Date(profile.subscription_expiry) > new Date());

        const isTesterTier = profile?.subscription_override === 'tester' ||
            profile?.subscription_override === 'tester_finger' ||
            user?.email?.toLowerCase().includes('finger');

        // Determine effective limit
        let limit = 3;
        if (isAdmin) limit = 9999;
        else if (isPremiumTier) limit = 9999;
        else if (isTesterTier) limit = 10;

        // If at or above limit, BLOCK.
        if (sermons.length >= limit) {
            alert(isAf
                ? `Jy het jou limiet van ${limit} gratis preke bereik. Gradeer asseblief op.`
                : `You have reached your limit of ${limit} free sermons. Please upgrade to continue.`
            );
            navigate('/subscription');
            return;
        }

        setCurrentSermon(null);
        setTitle('');
        setMainScripture('');
        setAudience('general');
        setTone('practical');
        setTheme('');
        setPlannedDuration(90);
        setStep('foundation');

        if (isTutorialMode) {
            setTutorialStepIdx(1); // Move to "The Title"
            setIsTutorialOpen(true);
        }
    };

    const handleResumeSermon = (sermon) => {
        setCurrentSermon(sermon);
        setPlannedDuration(sermon.planned_duration || 90);

        // Safety: Ensure step is valid, fallback to laboratory if it's already progressed
        const validSteps = ['foundation', 'skeleton', 'block-editor', 'laboratory', 'sermon-audit'];
        let step = sermon.step || 'skeleton';
        if (!validSteps.includes(step)) {
            step = sermon.blocks?.length > 0 ? 'laboratory' : 'skeleton';
        }
        setStep(step);
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

    const handleSuggestVerses = async () => {
        if (!title.trim()) {
            alert(isAf ? 'Voer asseblief eers \'n titel in.' : 'Please enter a title first.');
            return;
        }

        // --- REGISTRATION GATING ---
        const uid = user?.id || await getUserId();
        if (uid && uid.startsWith('user_')) {
            const promptMsg = isAf
                ? 'Om KI-versvoorstelle te kry, moet jy \'n gratis rekening skep!\n\nRekeninge is GRATIS en sluit beperkte AI-vrae in. Bybel lees, merk en soek bly GRATIS vir altyd.\n\nWil jy nou jou gratis rekening skep?'
                : 'To get AI verse suggestions, you need to create a free account!\n\nCreating an account is FREE and includes limited AI requests. Bible reading, highlighting, and exact search are FREE for life.\n\nWould you like to create your free account now?';

            if (window.confirm(promptMsg)) {
                navigate('/auth');
            }
            return;
        }

        setIsSuggestingVerses(true);
        try {
            const prompt = `Find 5 Bible verses that address the following request and return ONLY the verse references enclosed in double brackets and separated by commas (e.g. [[John 3:16]], [[Romans 5:8]]). Use modern citations. Request: ${title}`;
            const result = await askBibleQuestion(user.id, prompt, [], settings.language);

            if (result.success) {
                const matches = result.answer.match(/\[\[(.*?)\]\]/g) || [];
                const uniqueRefs = [...new Set(matches.map(m => m.replace(/\[\[|\]\]/g, '').trim()))];
                const cleanRefs = uniqueRefs.join(', ');

                if (cleanRefs) {
                    setMainScripture(cleanRefs);
                } else {
                    alert(isAf ? 'Kon nie verse vir hierdie titel vind nie.' : 'Could not find verses for this title.');
                }
            } else {
                alert(result.error || 'AI Error');
            }
        } catch (err) {
            console.error('Verse suggestion error:', err);
        } finally {
            setIsSuggestingVerses(false);
        }
    };

    const handleSuggestVersesSkeleton = async () => {
        if (!currentSermon) return;

        // --- REGISTRATION GATING ---
        const uid = user?.id || await getUserId();
        if (uid && uid.startsWith('user_')) {
            const promptMsg = isAf
                ? 'Om KI-versvoorstelle te kry, moet jy \'n gratis rekening skep!\n\nRekeninge is GRATIS en sluit beperkte AI-vrae in. Bybel lees, merk en soek bly GRATIS vir altyd.\n\nWil jy nou jou gratis rekening skep?'
                : 'To get AI verse suggestions, you need to create a free account!\n\nCreating an account is FREE and includes limited AI requests. Bible reading, highlighting, and exact search are FREE for life.\n\nWould you like to create your free account now?';

            if (window.confirm(promptMsg)) {
                navigate('/auth');
            }
            return;
        }

        setIsSuggestingVerses(true);
        try {
            const prompt = `Based on the sermon title '${currentSermon.title}', suggest 5 relevant Bible verses that are DIFFERENT from these current ones: ${currentSermon.main_scripture}. Return ONLY the verse references enclosed in double brackets and separated by commas (e.g. [[John 3:16]], [[Romans 5:8]]). Use modern citations.`;
            const result = await askBibleQuestion(user.id, prompt, [], settings.language);

            if (result.success) {
                const matches = result.answer.match(/\[\[(.*?)\]\]/g) || [];
                const uniqueRefs = [...new Set(matches.map(m => m.replace(/\[\[|\]\]/g, '').trim()))];
                const cleanRefs = uniqueRefs.join(', ');

                if (cleanRefs) {
                    const updatedSermon = { ...currentSermon, main_scripture: cleanRefs };
                    setCurrentSermon(updatedSermon);
                    // Update database
                    await updateSermon(currentSermon.id, { main_scripture: cleanRefs });
                } else {
                    alert(isAf ? 'Kon nie nuwe verse vir hierdie titel vind nie.' : 'Could not find new verses for this title.');
                }
            } else {
                alert(result.error || 'AI Error');
            }
        } catch (err) {
            console.error('Verse skeleton suggestion error:', err);
        } finally {
            setIsSuggestingVerses(false);
        }
    };

    const handleGenerateSkeleton = async () => {
        if (!title || !mainScripture) {
            alert(isAf ? 'Voer asseblief n titel en skrifgedeelte in.' : 'Please enter a title and scripture passage.');
            return;
        }

        // --- REGISTRATION GATING ---
        const uid = user?.id || await getUserId();
        if (uid && uid.startsWith('user_')) {
            const promptMsg = isAf
                ? 'Om preek raamwerke te genereer, moet jy \'n gratis rekening skep!\n\nRekeninge is GRATIS en sluit beperkte AI-vrae in. Bybel lees, merk en soek bly GRATIS vir altyd.\n\nWil jy nou jou gratis rekening skep?'
                : 'To generate sermon skeletons, you need to create a free account!\n\nCreating an account is FREE and includes limited AI requests. Bible reading, highlighting, and exact search are FREE for life.\n\nWould you like to create your free account now?';

            if (window.confirm(promptMsg)) {
                navigate('/auth');
            }
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

                    if (isTutorialMode) {
                        setIsTutorialMode(false);
                        setIsTutorialOpen(false);
                        setTutorialStepIdx(0);
                        localStorage.setItem('sermon_tutorial_completed', 'true');
                    }
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

    const handleRegenerateSkeleton = async () => {
        if (!currentSermon) return;
        if (!confirm(isAf ? 'Wil jy die hele raamwerk (blokke) her-genereer gebaseer op die nuwe skrifgedeeltes? Huidige notas sal verlore gaan.' : 'Regenerate the entire outline (blocks) based on new scriptures? Current notes will be lost.')) return;

        setIsGenerating(true);
        try {
            const result = await generateExegesis(
                currentSermon.main_scripture,
                currentSermon.title,
                currentSermon.audience,
                currentSermon.theme,
                settings.language,
                plannedDuration,
                currentSermon.tone
            );

            if (result.success) {
                const updatedSermon = { ...currentSermon, blocks: result.data.suggested_blocks };
                setCurrentSermon(updatedSermon);
                await updateSermon(currentSermon.id, { blocks: result.data.suggested_blocks });
            } else {
                alert(result.error);
            }
        } catch (err) {
            console.error(err);
            alert(isAf ? 'Fout met her-generering.' : 'Error regenerating.');
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

    const saveCurrentSermon = async (targetStep = null, updatedBlocks = null) => {
        if (!currentSermon) return { success: false };
        const result = await updateSermon(currentSermon.id, {
            blocks: updatedBlocks || currentSermon.blocks,
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
        // --- REGISTRATION GATING ---
        const uid = user?.id || await getUserId();
        if (uid && uid.startsWith('user_')) {
            const promptMsg = isAf
                ? 'Om al die blokke outomaties te genereer, moet jy \'n gratis rekening skep!\n\nRekeninge is GRATIS en sluit beperkte AI-vrae in. Bybel lees, merk en soek bly GRATIS vir altyd.\n\nWil jy nou jou gratis rekening skep?'
                : 'To auto-generate all blocks, you need to create a free account!\n\nCreating an account is FREE and includes limited AI requests. Bible reading, highlighting, and exact search are FREE for life.\n\nWould you like to create your free account now?';

            if (window.confirm(promptMsg)) {
                navigate('/auth');
            }
            return;
        }

        if (!confirm(isAf ? 'Wil jy inhoud outomaties genereer vir AL die blokke? Dit kan \'n paar oomblikke neem.' : 'Auto-generate content for ALL blocks? This may take a few moments.')) return;

        setIsAutoGenerating(true);
        const total = currentSermon.blocks.length;
        const updatedBlocks = [...currentSermon.blocks];

        for (let i = 0; i < total; i++) {
            setAutoGenerateProgress(i + 1);
            const block = updatedBlocks[i];

            // ALWAYS generate content for each block during batch mode
            const duration = parseInt(block.duration) || 5;

            // SPECIAL HANDLING FOR MICRO-BLOCKS (<= 1 min)
            // If the block is 1 min or less, 120 words is too much if there are many blocks.
            // We cut it to 60 words to ensure the total sermon length is manageable.
            const isMicroBlock = duration <= 1;
            const targetWords = isMicroBlock ? 60 : duration * 120;

            const strictLimit = targetWords + (isMicroBlock ? 15 : 25); // Hard cap

            const context = `Sermon: ${currentSermon.title}. Block: ${block.title}. Audience: ${currentSermon.audience}. Style/Tone: ${currentSermon.tone || 'balanced'}. Duration: ${duration} min. 
            STRICT CONSTRAINT: Target ${targetWords} words. MAXIMUM ${strictLimit} words.
            ${isMicroBlock ? 'KEEP IT BRIEF. Bullet points or a single paragraph only.' : 'You MUST keep it short.'}
            If you exceed ${strictLimit} words, the system will reject it.`;

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

    // v12.6: Lifted Preach Controls (MUST be at component scope, not inside handler)
    const PreachControls = () => {
        const [fontSize, setFontSize] = useState(22);
        const [isDark, setIsDark] = useState(false);
        const [isLocked, setIsLocked] = useState(false);
        const [timer, setTimer] = useState(0);
        const wakeLockRef = useRef(null);

        // Timer
        useEffect(() => {
            const interval = setInterval(() => setTimer(t => t + 1), 1000);
            return () => clearInterval(interval);
        }, []);

        const formatTime = (s) => {
            const m = Math.floor(s / 60).toString().padStart(2, '0');
            const sec = (s % 60).toString().padStart(2, '0');
            return `${m}:${sec}`;
        };

        const updateIframeStyle = (property, value) => {
            const iframe = document.getElementById('overlay-iframe');
            if (iframe && iframe.contentDocument) {
                iframe.contentDocument.documentElement.style.setProperty(property, value);
            }
        };

        const handleFont = (delta) => {
            const newSize = Math.max(16, Math.min(42, fontSize + delta));
            setFontSize(newSize);
            updateIframeStyle('--font-size', newSize + 'px');
        };

        const handleTheme = () => {
            const newDark = !isDark;
            setIsDark(newDark);
            if (newDark) {
                updateIframeStyle('--bg-color', '#121212');
                updateIframeStyle('--text-color', '#e5e5e5');
                updateIframeStyle('--highlight-color', '#3f2e00');
                updateIframeStyle('--accent-color', '#a78bfa');
            } else {
                updateIframeStyle('--bg-color', '#ffffff');
                updateIframeStyle('--text-color', '#121212');
                updateIframeStyle('--highlight-color', '#fef9c3');
                updateIframeStyle('--accent-color', '#7c3aed');
            }
        };

        const handleLock = async () => {
            if (!isLocked) {
                try {
                    if ('wakeLock' in navigator) {
                        wakeLockRef.current = await navigator.wakeLock.request('screen');
                        setIsLocked(true);
                    }
                } catch (e) {
                    console.error('Lock failed', e);
                    alert('Wake Lock failed: ' + e.message);
                }
            } else {
                if (wakeLockRef.current) {
                    await wakeLockRef.current.release();
                    wakeLockRef.current = null;
                }
                setIsLocked(false);
            }
        };

        // Auto-Lock on Mount
        useEffect(() => { handleLock(); return () => { if (wakeLockRef.current) wakeLockRef.current.release(); } }, []);

        const btnStyle = {
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.2)',
            color: 'white',
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            fontSize: '20px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        };

        return (
            <>
                <button style={btnStyle} onClick={() => handleFont(-2)}>A-</button>
                <div style={{ color: 'white', fontWeight: 'bold', fontSize: '18px', minWidth: '60px', textAlign: 'center', alignSelf: 'center' }}>
                    {formatTime(timer)}
                </div>
                <button style={btnStyle} onClick={() => handleFont(2)}>A+</button>
                <button style={btnStyle} onClick={handleTheme}>{isDark ? '🌙' : '☀️'}</button>
                <button style={{ ...btnStyle, color: isLocked ? '#4ade80' : '#6b7280', borderColor: isLocked ? '#4ade80' : 'rgba(255,255,255,0.2)' }} onClick={handleLock}>
                    {isLocked ? '🔒' : '🔓'}
                </button>
            </>
        );
    };

    const handlePreachMode = async () => {
        // 1. Build the HTML content (similar to PDF but optimized for screens)
        const sermonTitle = currentSermon.title || (isAf ? 'Preek Konsep' : 'Sermon Draft');

        // Ensure we have text to display, otherwise show a friendly message
        const textToFormat = currentSermon.full_text || (isAf ? 'Geen preek inhoud gevind nie. Gaan terug en genereer eers jou preek.' : 'No sermon content found. Go back and generate your sermon first.');

        const formattedHtml = formatSermonHtml(textToFormat);

        // v12.6: Refactored to use In-App Overlay instead of window.open (Mobile Fix)
        // 2. Open Overlay
        setOverlayState({
            isOpen: true,
            title: isAf ? 'Preek Modus' : 'Preach Mode',
            controlsType: 'preach',
            content: `
            <!DOCTYPE html>
            <html lang="${isAf ? 'af' : 'en'}">
            <head>
                <meta charset="UTF-8">
                <link rel="icon" href="data:,">
                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, minimal-ui">
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
                        padding: 20px 20px 200px 20px; /* Bottom padding for controls */
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
                <script>
                // Storage key for this sermon
                const STORAGE_KEY = 'preach_bookmark_${currentSermon?.id || 'default'}';
                
                // Restore bookmark on load
                document.addEventListener('DOMContentLoaded', function() {
                    const savedIndex = localStorage.getItem(STORAGE_KEY);
                    if (savedIndex !== null) {
                        const lines = document.querySelectorAll('.preach-line, li');
                        const idx = parseInt(savedIndex);
                        if (lines[idx]) {
                            lines[idx].classList.add('reading-active');
                            setTimeout(() => {
                                lines[idx].scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }, 100);
                        }
                    }
                });
                
                // Save bookmark on click
                document.addEventListener('click', function(e) {
                    const target = e.target.closest('.preach-line') || e.target.closest('li');
                    if (target) {
                        // Toggle active state
                        document.querySelectorAll('.reading-active').forEach(el => el.classList.remove('reading-active'));
                        target.classList.add('reading-active');
                        
                        // Save index to localStorage
                        const lines = document.querySelectorAll('.preach-line, li');
                        const idx = Array.from(lines).indexOf(target);
                        if (idx >= 0) {
                            localStorage.setItem(STORAGE_KEY, idx.toString());
                        }
                    }
                });
                </script>
            </body>
            </html>
            `
        });
    };

    // v12.6: Lifted TTS Controls
    const TTSControls = () => {
        const [voices, setVoices] = useState([]);
        const [selectedVoiceIndex, setSelectedVoiceIndex] = useState('');
        const [isPlaying, setIsPlaying] = useState(false);
        const [isPaused, setIsPaused] = useState(false);

        useEffect(() => {
            const load = () => {
                const allVoices = window.speechSynthesis.getVoices();
                const langPref = settings.language === 'af' || isAf ? 'af' : 'en';
                // Basic filtering
                let filtered = allVoices.filter(v => v.lang.startsWith(langPref));
                if (filtered.length === 0) filtered = allVoices;
                setVoices(filtered);
                // Default selection
                if (filtered.length > 0) setSelectedVoiceIndex(0);
            };

            load();
            if (window.speechSynthesis.onvoiceschanged !== undefined) {
                window.speechSynthesis.onvoiceschanged = load;
            }
        }, []);

        const handlePlay = () => {
            if (window.speechSynthesis.speaking && !isPaused) {
                window.speechSynthesis.pause();
                setIsPaused(true);
                setIsPlaying(false);
            } else if (isPaused) {
                window.speechSynthesis.resume();
                setIsPaused(false);
                setIsPlaying(true);
            } else {
                // New Playback
                // We need to get text content from iframe. This requires the iframe to be accessible.
                const iframe = document.getElementById('overlay-iframe');
                if (!iframe || !iframe.contentDocument) return;

                const content = iframe.contentDocument.getElementById('tts-content').innerText;
                const utterance = new SpeechSynthesisUtterance(content);
                const voice = voices[selectedVoiceIndex];
                if (voice) utterance.voice = voice;
                utterance.rate = 0.95;

                utterance.onstart = () => { setIsPlaying(true); setIsPaused(false); };
                utterance.onend = () => { setIsPlaying(false); setIsPaused(false); };

                window.speechSynthesis.speak(utterance);
            }
        };

        const handleStop = () => {
            window.speechSynthesis.cancel();
            setIsPlaying(false);
            setIsPaused(false);
        };

        const handleCopy = async () => {
            const iframe = document.getElementById('overlay-iframe');
            if (!iframe || !iframe.contentDocument) return;

            const text = iframe.contentDocument.getElementById('tts-content').innerText;
            try {
                await navigator.clipboard.writeText(text);
                alert(isAf ? 'Gekopieer!' : 'Copied!');
            } catch (e) {
                alert('Error copying: ' + e.message);
            }
        };

        const btnStyle = {
            background: '#7c3aed',
            color: 'black',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '25px',
            fontWeight: '700',
            fontSize: '15px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            whiteSpace: 'nowrap'
        };

        return (
            <>
                <select
                    style={{
                        background: '#334155', color: 'white', border: '1px solid #475569',
                        borderRadius: '12px', padding: '8px 12px', outline: 'none', maxWidth: '150px'
                    }}
                    value={selectedVoiceIndex}
                    onChange={(e) => setSelectedVoiceIndex(e.target.value)}
                >
                    {voices.map((v, i) => (
                        <option key={i} value={i}>{v.name.slice(0, 20)}...</option>
                    ))}
                </select>

                <button style={{ ...btnStyle, background: '#f59e0b', color: 'white' }} onClick={handlePlay}>
                    {isPlaying && !isPaused ? (isAf ? '⏸️ Pause' : '⏸️ Pause') : (isPaused ? (isAf ? '▶️ Hervat' : '▶️ Resume') : (isAf ? '▶️ Speel' : '▶️ Play'))}
                </button>

                <button style={{ ...btnStyle, background: '#64748b', color: 'white' }} onClick={handleStop} disabled={!isPlaying && !isPaused}>
                    ⏹️
                </button>

                <button style={{ ...btnStyle, background: '#10b981', color: 'white' }} onClick={handleCopy}>
                    📋 {isAf ? 'Kopieer' : 'Copy'}
                </button>
            </>
        );
    };

    const handleTTSView = () => {
        if (!currentSermon) {
            alert("No sermon data found.");
            return;
        }

        const safe = (str) => (str || '').replace(/[`$]/g, '');
        const isAfSermon = settings.language === 'af';
        const sermonTitle = safe(currentSermon.title || (isAf ? 'Preek' : 'Sermon')) + " - TTS";
        const L = {
            converting: isAfSermon ? 'Besig met omskakeling...' : 'Converting Audio...',
            preparing: isAfSermon ? 'Berei voor...' : 'Preparing content...',
            downloads: isAfSermon ? 'Kontroleer asseblief u "Downloads" gids na voltooiing.' : 'Please check your "Downloads" folder after completion.',
            audioParts: isAfSermon ? 'Klank Dele (4)' : 'Audio Parts (4)',
            downloadAll: isAfSermon ? 'Laai Alles Af' : 'Download All Parts',
            openSave: isAfSermon ? 'Deel' : 'Part',
            ready: isAfSermon ? 'v12: 4 klank dele is gereed.' : 'v12: 4 audio parts are ready.',
        };

        const ttsBody = currentSermon.blocks && currentSermon.blocks.length > 0
            ? currentSermon.blocks.map(block => {
                return `
                    <div class="block-section">
                        <div class="tts-text">${scrubText(block.notes || '', block.title, currentSermon.title)}</div>
                    </div>
                `;
            }).join('')
            : `<div class="tts-text">${scrubText(currentSermon.full_text || '', currentSermon.title, currentSermon.title)}</div>`;


        const htmlContent = `
            <!DOCTYPE html>
            <html lang="${isAfSermon ? 'af' : 'en'}">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
                <title>🎙️ TTS v12 - ${sermonTitle}</title>
                <style>
                    :root {
                        --bg-color: #0f172a;
                        --text-color: #f8fafc;
                        --accent-color: #38bdf8;
                        --card-bg: #1e293b;
                        --font-size: 24px;
                    }
                    body {
                        font-family: 'Inter', system-ui, -apple-system, sans-serif;
                        line-height: 1.8;
                        color: var(--text-color);
                        background: var(--bg-color);
                        margin: 0;
                        padding: 20px 20px 200px 20px; /* Big padding for lifted controls */
                        font-size: var(--font-size);
                        max-width: 900px;
                        margin: 0 auto;
                    }
                    h1 { color: var(--accent-color); text-align: center; font-size: 1.5em; margin-bottom: 30px; border-bottom: 2px solid var(--accent-color); padding-bottom: 15px; }
                    .tts-text { 
                        background: var(--card-bg); 
                        padding: 30px; 
                        border-radius: 16px; 
                        margin-bottom: 20px; 
                        white-space: pre-wrap;
                        border-left: 4px solid var(--accent-color);
                        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
                    }
                </style>
            </head>
            <body>
                <div id="tts-content">
                    <div class="block-section">
                        <h1>${sermonTitle.replace(' - TTS', '')}</h1>
                    </div>
                    ${ttsBody}
                </div>
            </body>
            </html>
        `;

        setOverlayState({
            isOpen: true,
            title: isAf ? 'TTS PDF' : 'TTS Reader',
            controlsType: 'tts',
            content: htmlContent
        });
    };

    const handleExportPDF = () => {
        if (!currentSermon) return;

        // v12.6: Use Overlay for PDF Preview
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

                    .back-btn {background: #64748b; color: white; }
                    .print-btn {background: #2563eb; color: white; }

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
                        -webkit - print - color - adjust: exact;
                    print-color-adjust: exact; 
                        }
                    .no-print, .pdf-nav-header {display: none !important; }
                    .block {page -break-inside: auto; margin-bottom: 30px; }
                    }
                </style>
            </head>
            <body>
                <div class="pdf-nav-header no-print">
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

        setOverlayState({
            isOpen: true,
            title: isAf ? 'PDF Voorskou' : 'PDF Preview',
            content: content
        });
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
            estimatedMin: Math.round(totalWords / 120) // Standardized to 120 WPM
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
                {/* Mobile Only Title (Context) */}
                <div className="mobile-sermon-title">
                    <h2>{currentSermon.title}</h2>
                    <span className="scripture-badge">{currentSermon.main_scripture}</span>
                </div>

                <div className="time-budget-header">
                    <div className="time-stat">
                        <span className="time-label">{isAf ? 'Tyd Beplan' : 'Time Planned'}</span>
                        <div className="budget-edit-wrapper">
                            <input
                                type="number"
                                className={`time - value budget - input ${isOverBudget ? 'over-budget' : ''} `}
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
                            className={`auto - gen - all - btn ${isAutoGenerating ? 'processing' : ''} `}
                            onClick={handleAutoGenerateBlocks}
                            disabled={isAutoGenerating}
                        >
                            {isAutoGenerating ? (
                                <>
                                    <span className="spinner">⏳</span>
                                    {isAf ? `Besig... (${autoGenerateProgress} /${currentSermon.blocks.length})` : `Processing... (${autoGenerateProgress}/${currentSermon.blocks.length})`}
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
                            <div style={{ width: '100%' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <strong>{isAf ? 'Skrif:' : 'Scripture:'}</strong>
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        <button
                                            className="ai-suggest-btn"
                                            onClick={handleSuggestVersesSkeleton}
                                            disabled={isSuggestingVerses}
                                            title={isAf ? "Stel ander verse voor" : "Suggest different verses"}
                                            style={{
                                                background: 'rgba(56, 189, 248, 0.1)',
                                                border: '1px solid var(--accent-primary)',
                                                color: 'var(--accent-primary)',
                                                borderRadius: '4px',
                                                padding: '2px 6px',
                                                fontSize: '0.7rem',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}
                                        >
                                            {isSuggestingVerses ? '...' : '✨ ' + (isAf ? 'Wissel' : 'Rotate')}
                                        </button>
                                        <button
                                            className="ai-suggest-btn"
                                            onClick={handleRegenerateSkeleton}
                                            disabled={isGenerating}
                                            title={isAf ? "Her-genereer raamwerk" : "Regenerate outline"}
                                            style={{
                                                background: 'rgba(236, 72, 153, 0.1)',
                                                border: '1px solid #ec4899',
                                                color: '#ec4899',
                                                borderRadius: '4px',
                                                padding: '2px 6px',
                                                fontSize: '0.7rem',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}
                                        >
                                            {isGenerating ? '...' : '🔄 ' + (isAf ? 'Herstel' : 'Redo')}
                                        </button>
                                    </div>
                                </div>
                                <div style={{ fontSize: '0.9rem', marginTop: '4px' }}>
                                    {currentSermon.main_scripture}
                                </div>
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

                                        // --- REGISTRATION GATING ---
                                        const uid = user?.id || await getUserId();
                                        if (uid && uid.startsWith('user_')) {
                                            const promptMsg = isAf
                                                ? 'Om AI-inhoud vir blokke te genereer, moet jy \'n gratis rekening skep!\n\nRekeninge is GRATIS en sluit beperkte AI-vrae in. Bybel lees, merk en soek bly GRATIS vir altyd.\n\nWil jy nou jou gratis rekening skep?'
                                                : 'To generate AI content for blocks, you need to create a free account!\n\nCreating an account is FREE and includes limited AI requests. Bible reading, highlighting, and exact search are FREE for life.\n\nWould you like to create your free account now?';

                                            if (window.confirm(promptMsg)) {
                                                navigate('/auth');
                                            }
                                            return;
                                        }

                                        if (!confirm(isAf ? 'Wil jy inhoud genereer vir hierdie blok?' : 'Generate content for this block?')) return;

                                        const duration = parseInt(block.duration) || 5;
                                        const targetWords = duration * 120; // 120 WPM
                                        const context = `Sermon: ${currentSermon.title}.Scripture: ${currentSermon.main_scripture}.Block: ${block.title}.Audience: ${currentSermon.audience}.Style / Tone: ${currentSermon.tone || 'balanced'}.Duration: ${duration} min.TARGET LENGTH: ~${targetWords} spoken words.`;
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
        // --- REGISTRATION GATING ---
        const uid = user?.id || await getUserId();
        if (uid && uid.startsWith('user_')) {
            const promptMsg = isAf
                ? 'Om AI-gereedskap te gebruik, moet jy \'n gratis rekening skep!\n\nRekeninge is GRATIS en sluit beperkte AI-vrae in. Bybel lees, merk en soek bly GRATIS vir altyd.\n\nWil jy nou jou gratis rekening skep?'
                : 'To use AI tools, you need to create a free account!\n\nCreating an account is FREE and includes limited AI requests. Bible reading, highlighting, and exact search are FREE for life.\n\nWould you like to create your free account now?';

            if (window.confirm(promptMsg)) {
                navigate('/auth');
            }
            return;
        }

        if (!aiQuery) {
            // polish_all and suggest_context and generate_podcast and generate_narrative don't need aiQuery
            const skipQueryCheck = ['suggest_context', 'polish_all', 'generate_podcast', 'generate_narrative'].includes(tool);
            if (!skipQueryCheck) {
                alert(isAf ? "Tik asseblief 'n soekterm of vraag in." : "Please enter a search term or question.");
                return;
            }
        }

        // Special check for polish_all quota
        if (tool === 'polish_all' && !canAccessAudit) {
            handlePremiumLockClick('audit');
            return;
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

        // Custom logic for polish_all, generate_podcast, or generate_narrative: gather all blocks
        if (effectiveTool === 'polish_all' || effectiveTool === 'generate_podcast' || effectiveTool === 'generate_narrative') {
            const allNotes = currentSermon.blocks.map((b, i) => `Point ${i + 1} (${b.title}): \n${b.notes || ''} `).join('\n\n');
            const finalPolish = currentSermon.full_text ? `\n\nFinal Polish: \n${currentSermon.full_text} ` : '';

            if (effectiveTool === 'polish_all') {
                // Calculate Time Budget
                const totalMinutes = currentSermon.blocks.reduce((acc, b) => acc + (parseInt(b.duration) || 0), 0);
                const targetWords = totalMinutes * 120; // 120 WPM
                const timeContext = `\n\nTIME BUDGET: ${totalMinutes} minutes.\nTARGET WORD COUNT: ~${targetWords} words(Aim to strictly maintain this length).`;

                finalQuery = `TITLE: ${currentSermon.title}${timeContext} \n\n${allNotes}${finalPolish} `;
            } else {
                // generate_podcast or generate_narrative
                finalQuery = `TITLE: ${currentSermon.title} \n\n${allNotes}${finalPolish} `;
            }
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

                        // Auto-apply logic
                        let updatedBlocks = [...currentSermon.blocks];
                        auditData.suggestions.forEach(s => {
                            if (updatedBlocks[s.index]) {
                                updatedBlocks[s.index] = { ...updatedBlocks[s.index], notes: s.suggested };
                            }
                        });

                        setCurrentSermon({ ...currentSermon, blocks: updatedBlocks });
                        await saveCurrentSermon('laboratory', updatedBlocks);

                        setAuditReview({
                            analysis: auditData.analysis || '',
                            rating: auditData.rating || 0,
                            suggestions: auditData.suggestions,
                            isApplied: true
                        });

                        setStep('sermon-audit');
                        setIsAiPanelOpen(false);
                        alert(isAf ? `Preek gepoleer! Graad: ${auditData.rating || 0}/100` : `Sermon polished! Rating: ${auditData.rating || 0}/100`);

                        // Increment Quota
                        if (!canAccessPremium) {
                            await incrementSermonAuditCount();
                            fetchProfile(); // Refresh profile to update count UI
                        }
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
                            textarea.style.width = '100px';
                            textarea.style.height = '100px';
                            textarea.style.opacity = '0.01';
                            textarea.style.fontSize = '16px';
                            textarea.setAttribute('readonly', '');
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

                // Special popup for scripts instead of standard alert
                const isScript = content.includes('HOST:') || content.includes('EXPERT:') || content.includes('NARRATOR:');
                if (isScript) {
                    setScriptCopyNote({ type: content.includes('HOST:') ? 'generate_podcast' : 'generate_narrative' });
                } else {
                    alert(isAf ? 'Gekopieer na knipbord!' : 'Copied to clipboard!');
                }

                setIsAiPanelOpen(false);
                return;
            } catch (clipErr) {
                console.log('Clipboard API failed:', clipErr);
            }
        }

        // Fallback: execCommand
        if (fallbackCopy()) {
            const isScript = content.includes('HOST:') || content.includes('EXPERT:') || content.includes('NARRATOR:');
            if (isScript) {
                setScriptCopyNote({ type: content.includes('HOST:') ? 'generate_podcast' : 'generate_narrative' });
            } else {
                alert(isAf ? 'Gekopieer na knipbord!' : 'Copied to clipboard!');
            }
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
        const estimatedTime = Math.ceil(wordCount / 120); // 120 WPM

        const timeDiff = estimatedTime - block.duration;
        let timeStatus = 'neutral';
        if (timeDiff > 2) timeStatus = 'over';
        if (timeDiff < -2) timeStatus = 'under';

        const handleRegenerate = async () => {
            if (!confirm(isAf ? 'Wil jy die inhoud oor-genereer? Dit sal die huidige teks vervang.' : 'Regenerate content? This will replace current text.')) return;
            setAiLoading(true);
            setAiLoading(true);
            const duration = parseInt(block.duration) || 5;
            const targetWords = duration * 120; // 120 WPM
            const context = `Sermon: ${currentSermon.title}. Block: ${block.title}. Duration: ${duration} min. TARGET LENGTH: ~${targetWords} spoken words.`;
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
                                <button
                                    className="ai-tool-btn"
                                    onClick={() => canAccessPremium ? handleRunAiTool('generate_podcast') : handlePremiumLockClick('podcast')}
                                    style={{ borderColor: '#ec4899', color: '#ec4899' }}
                                >
                                    <span className="ai-tool-icon">{canAccessPremium ? '🎙️' : '🔒'}</span>
                                    <span className="ai-tool-label">{isAf ? 'Podgooi Skrip' : 'Podcast Script'}</span>
                                </button>
                                <button className="ai-tool-btn" onClick={() => canAccessAudit ? handleRunAiTool('polish_all') : handlePremiumLockClick('audit')}>
                                    <span className="ai-tool-icon">{canAccessAudit ? '⚖️' : '🔒'}</span>
                                    <span className="ai-tool-label">{isAf ? 'Oudit Preek' : 'Audit Sermon'}</span>
                                </button>
                                <button
                                    className="ai-tool-btn"
                                    onClick={() => canAccessPremium ? handleRunAiTool('generate_narrative') : handlePremiumLockClick('narrator')}
                                    style={{ borderColor: '#8b5cf6', color: '#8b5cf6' }}
                                >
                                    <span className="ai-tool-icon">{canAccessPremium ? '📄' : '🔒'}</span>
                                    <span className="ai-tool-label">{isAf ? 'Verteller Skrip' : 'Narrator Script'}</span>
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
                    <button
                        className="action-btn secondary pdf-btn"
                        onClick={() => canAccessPremium ? handlePreachMode() : handlePremiumLockClick('preach')}
                        style={{ borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)' }}
                    >
                        {canAccessPremium ? '🗣️' : '🔒'} {isAf ? 'Preek Modus' : 'Preach Mode'}
                    </button>
                    <button
                        className="action-btn secondary tts-btn"
                        onClick={() => canAccessPremium ? handleTTSView() : handlePremiumLockClick('tts')}
                        style={{ borderColor: '#38bdf8', color: '#38bdf8' }}
                    >
                        {canAccessPremium ? '🎙️' : '🔒'} {isAf ? 'TTS PDF' : 'TTS PDF'}
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
                        ? `Jy het reeds jou ${isFingerUser || profile?.subscription_override === 'tester' ? '10' : '3'} gratis preke gebou. Gradeer op na Pro vir onbeperkte toegang!`
                        : `You have already built your ${isFingerUser || profile?.subscription_override === 'tester' ? '10' : '3'} free sermons. Upgrade to Pro for unlimited access!`}
                </p>
                <div className="premium-features">
                    <span>✅ {isAf ? 'Onbeperkte AI Analise' : 'Unlimited AI Analysis'}</span>
                    <span>✅ {isAf ? 'Gevorderde Navorsingsgereedskap' : 'Advanced Research Tools'}</span>
                    <span>✅ {isAf ? 'PDF Uitvoer & Druk' : 'PDF Export & Print'}</span>
                </div>
                <button className="gate-btn premium-btn" onClick={() => navigate('/subscription')}>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <h2>{isAf ? 'My Preke' : 'My Sermons'}</h2>
                    <label className="tutorial-toggle" style={{
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        background: 'rgba(56, 189, 248, 0.1)',
                        borderRadius: '20px',
                        color: 'var(--accent-primary)',
                        cursor: 'pointer',
                        border: '1px solid rgba(56, 189, 248, 0.2)'
                    }}>
                        <input
                            type="checkbox"
                            checked={isTutorialMode}
                            onChange={(e) => {
                                setIsTutorialMode(e.target.checked);
                                setIsTutorialOpen(e.target.checked);
                                if (e.target.checked) setTutorialStepIdx(0);
                            }}
                        />
                        {isAf ? 'Handleiding Mode' : 'Tutorial Mode'}
                    </label>
                </div>

                {profile && profile.subscription_tier === 'free' && (
                    <button
                        className="new-sermon-btn subscriber-btn"
                        onClick={() => navigate('/subscription')}
                    >
                        {isAf ? 'Word \'n Intekenaar' : 'Become a Subscriber'}
                    </button>
                )}

                <button id="tutorial-new-sermon" className="new-sermon-btn main-action-btn" onClick={handleStartNew}>
                    + {isAf ? 'Nuwe Preek' : 'New Sermon'}
                </button>

                {profile && profile.subscription_tier === 'free' && (
                    <div className="trial-counter">
                        {isAf ? 'Gratis Preke oor:' : 'Free Trials left:'}
                        {(() => {
                            const limit = (isFingerUser || profile?.subscription_override === 'tester') ? 10 : 3;
                            const left = Math.max(0, limit - profile.sermon_trial_count);
                            return (
                                <span className={left <= 1 ? 'critical' : ''}>
                                    {left} / {limit}
                                </span>
                            );
                        })()}
                    </div>
                )}
            </div>

            {isLoading ? (
                <div className="loading-spinner"></div>
            ) : (
                <div className="sermon-grid">
                    {sermons.map((sermon, index) => {
                        // Check Premium Status
                        const isPremium = profile?.subscription_override === 'premium' ||
                            profile?.subscription_override === 'admin' ||
                            profile?.subscription_override === 'tester' ||
                            profile?.subscription_override === 'tester_finger' ||
                            isFingerUser ||
                            (profile?.subscription_expiry && new Date(profile.subscription_expiry) > new Date());

                        const isLocked = !isPremium && index >= 3;
                        const isTesterLocked = (profile?.subscription_override === 'tester' || profile?.subscription_override === 'tester_finger' || isFingerUser) && index >= 10;

                        const locked = isLocked || isTesterLocked;

                        return (
                            <div
                                key={sermon.id}
                                className={`sermon-card ${locked ? 'locked' : ''}`}
                                onClick={() => !locked && handleResumeSermon(sermon)}
                                style={locked ? { opacity: 0.6, cursor: 'not-allowed', position: 'relative' } : {}}
                            >
                                {locked && (
                                    <div className="lock-overlay" style={{
                                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                        background: 'rgba(0,0,0,0.5)', borderRadius: '12px', zIndex: 10
                                    }}>
                                        <div style={{ fontSize: '2rem' }}>🔒</div>
                                        <div style={{ color: 'white', fontWeight: 'bold', marginTop: '8px' }}>
                                            {isAf ? 'Gradeer Op' : 'Upgrade'}
                                        </div>
                                    </div>
                                )}

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
                                            width: sermon.step === 'laboratory' ? '100%' :
                                                sermon.step === 'skeleton' ? '50%' : '15%',
                                            background: sermon.step === 'laboratory' ? '#10b981' : undefined // Green if complete
                                        }}
                                    ></div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );


    const renderSermonAudit = () => {
        if (!auditReview || !currentSermon) return null;

        return (
            <div className="sermon-audit-page">
                <div className="audit-header">
                    <div className="audit-header-content">
                        <h2>⚖️ {isAf ? 'Preek Oudit Opsomming' : 'Sermon Audit Summary'}</h2>
                        <p className="sermon-title-sub">{currentSermon.title}</p>
                    </div>
                    <button className="exit-audit-btn" onClick={() => {
                        setAuditReview(null);
                        setStep('laboratory');
                    }}>
                        ✕ {isAf ? 'Sluit' : 'Close'}
                    </button>
                </div>

                <div className="audit-content-layout">
                    <div className="audit-main-area">
                        <div className="audit-score-card">
                            <div className="score-circle">
                                <span className="score-value">{auditReview.rating}</span>
                                <span className="score-label">/ 100</span>
                            </div>
                            <div className="score-text">
                                <h3>{isAf ? 'Preek Graad' : 'Sermon Rating'}</h3>
                                <p>{isAf ? 'Hierdie graad is gebaseer op homiletiese vloei, skriftuurlike akkuraatheid en praktiese toepassing.' : 'This rating is based on homiletical flow, scriptural accuracy, and practical application.'}</p>
                                <div className="verdict-pill">
                                    {auditReview.rating >= 80 ? (isAf ? '✅ Uitstekend' : '✅ Excellent') :
                                        auditReview.rating >= 60 ? (isAf ? '⚠️ Goed' : '⚠️ Good') :
                                            (isAf ? '❌ Benodig Aandag' : '❌ Needs Attention')}
                                </div>
                            </div>
                        </div>

                        <div className="audit-info-card">
                            <div className="analysis-summary">
                                <h3>{isAf ? 'Oudit Analise' : 'Audit Analysis'}</h3>
                                <p>{auditReview.analysis}</p>
                                <p className="formatting-note">
                                    <small>✨ {isAf ? 'Instruksies (Rooi) en Skrif (Blou) is behou.' : 'Instructions (Red) and Scripture (Blue) were preserved.'}</small>
                                </p>
                            </div>
                        </div>

                        <div className="applied-changes-list">
                            <h3>✅ {isAf ? 'Outomatiese Veranderinge' : 'Automatic Changes Applied'}</h3>
                            <p className="changes-intro">{isAf ? 'Die volgende aspekte van jou preek is geoptimaliseer terwyl die styl en skrifgedeeltes behou is:' : 'The following aspects of your sermon have been optimized while preserving style and scriptures:'}</p>
                            <div className="changes-grid">
                                {auditReview.suggestions.map((s, idx) => (
                                    <div key={idx} className="applied-change-item">
                                        <div className="change-header">
                                            <span className="point-badge">{isAf ? 'Punt' : 'Point'} {s.index + 1}</span>
                                        </div>
                                        <p className="change-reason">{s.reason}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="audit-footer-actions">
                            <button className="primary-btn" onClick={() => {
                                setAuditReview(null);
                                setStep('laboratory');
                            }}>
                                {isAf ? 'Klaar' : 'Done'}
                            </button>
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
                        id="tutorial-foundation-title"
                        type="text"
                        placeholder={isAf ? 'bv. Die Verlore Seun' : 'e.g. The Prodigal Son'}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />
                </div>

                <div className="input-group">
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <span>
                            {isAf ? 'Hoof Skrifgedeelte(s)' : 'Main Scripture Passage(s)'}
                            <span className="ai-badge">AI Analysis</span>
                            <span style={{ color: 'red' }}>*</span>
                        </span>
                        <button
                            className="ai-suggest-btn"
                            onClick={handleSuggestVerses}
                            disabled={isSuggestingVerses || !title.trim()}
                            title={isAf ? "Stel verse voor gebaseer op titel" : "Suggest verses based on title"}
                            style={{
                                background: 'rgba(56, 189, 248, 0.1)',
                                border: '1px solid var(--accent-primary)',
                                color: 'var(--accent-primary)',
                                borderRadius: '4px',
                                padding: '2px 8px',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}
                        >
                            {isSuggestingVerses ? (
                                <div className="loading-spinner" style={{ width: '12px', height: '12px', borderWeight: '2px' }}></div>
                            ) : '✨ ' + (isAf ? 'Stel Verse Voor' : 'Suggest AI Verses')}
                        </button>
                    </label>
                    <input
                        id="tutorial-foundation-scripture"
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
                        <option value="wedding">{isAf ? 'Troue (Bruidspaar & Gaste)' : 'Wedding (Couple & Guests)'}</option>
                    </select>
                </div>

                <div className="input-group">
                    <label>{isAf ? 'Styl / Toon' : 'Style / Tone'}</label>
                    <select value={tone} onChange={(e) => setTone(e.target.value)}>
                        <option value="practical">{isAf ? 'Prakties & Direk *' : 'Practical & Punchy *'}</option>
                        <option value="balanced">{isAf ? 'Gebalanseerd' : 'Balanced'}</option>
                        <option value="high_energy">{isAf ? 'Dinamies & Hoë Energie' : 'Dynamic & High Energy'}</option>
                        <option value="compassionate">{isAf ? 'Sag & Deernisvol' : 'Soft & Compassionate'}</option>
                        <option value="deep">{isAf ? 'Teologies & Diep' : 'Theological & Deep'}</option>
                    </select>
                </div>

                <div className="input-group">
                    <label>{isAf ? 'Beplande Tyd (Minute)' : 'Planned Duration (Minutes)'}</label>
                    <input
                        type="number"
                        min="5"
                        max="240"
                        value={plannedDuration === 0 ? '' : plannedDuration}
                        onFocus={(e) => {
                            if (plannedDuration === 0 || plannedDuration === 90) e.target.select();
                        }}
                        onChange={(e) => {
                            const val = e.target.value;
                            if (val === '') setPlannedDuration(0);
                            else setPlannedDuration(parseInt(val) || 0);
                        }}
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
                    id="tutorial-start-building"
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

    const renderScriptCopyNote = () => {
        if (!scriptCopyNote) return null;
        const isPodcast = scriptCopyNote.type === 'generate_podcast';

        return (
            <div className="copy-modal-overlay" onClick={() => setScriptCopyNote(null)}>
                <div className="copy-modal-content script-note" onClick={e => e.stopPropagation()}>
                    <div className="script-note-icon" style={{ fontSize: '3rem', marginBottom: '12px' }}>{isPodcast ? '🎙️' : '📄'}</div>
                    <h3 style={{ margin: '12px 0', fontSize: '1.5rem', color: 'var(--text-primary)' }}>{isAf ? 'Skrip Gekopieer!' : 'Script Copied!'}</h3>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '20px' }}>
                        {isAf
                            ? `Hierdie ${isPodcast ? 'podgooi-skrip' : 'verteller-skrip'} is nou op jou knipbord. Jy kan dit in enige TTS (Text-to-Speech) sagteware gebruik.`
                            : `This ${isPodcast ? 'podcast script' : 'narrator script'} is now on your clipboard. You can use it in any TTS (Text-to-Speech) software.`}
                    </p>
                    <div className="external-tool-tip" style={{
                        background: 'rgba(var(--accent-primary-rgb), 0.1)',
                        padding: '16px',
                        borderRadius: '12px',
                        marginBottom: '24px',
                        border: '1px dashed var(--accent-primary)',
                        textAlign: 'left'
                    }}>
                        <strong style={{ display: 'block', marginBottom: '4px', color: 'var(--accent-primary)' }}>
                            💡 {isAf ? 'Wenk:' : 'Tip:'}
                        </strong>
                        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                            {isAf
                                ? 'Gebruik dit in Google NotebookLM vir \'n professionele klank-oorsig!'
                                : 'Use it in Google NotebookLM for a professional audio overview!'}
                        </p>
                    </div>
                    <button className="gate-btn primary" onClick={() => setScriptCopyNote(null)} style={{ width: '100%', padding: '14px', borderRadius: '12px', background: 'var(--accent-primary)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
                        {isAf ? 'Ek Verstaan' : 'I Understand'}
                    </button>
                </div>
            </div>
        );
    };

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
            {/* Script Copy Notification */}
            {scriptCopyNote && renderScriptCopyNote()}

            <TutorialOverlay
                isOpen={isTutorialOpen}
                steps={tutorialSteps}
                language={settings.language}
                externalStepIdx={isTutorialMode ? tutorialStepIdx : null}
                onNext={(idx) => {
                    // Detect Finish button (last step)
                    if (idx === tutorialSteps.length - 1) {
                        setIsTutorialOpen(false);
                        setIsTutorialMode(false);
                        setTutorialStepIdx(0);
                        localStorage.setItem('tutorial_completed', 'true');
                        return;
                    }

                    // In manual mode, simple next
                    if (!isTutorialMode) {
                        // handled internally by TutorialOverlay
                    } else {
                        // If they are on Step 1 (idx 0) and click Next, trigger the New Sermon logic
                        if (idx === 0) {
                            handleStartNew();
                        } else {
                            // In Tutorial Mode, we guide them but let them skip ahead if they want
                            setTutorialStepIdx(prev => Math.min(prev + 1, tutorialSteps.length - 1));
                        }
                    }
                }}
                onComplete={() => {
                    setIsTutorialOpen(false);
                    setIsTutorialMode(false);
                    setTutorialStepIdx(0);
                    localStorage.setItem('tutorial_completed', 'true');
                }}
            />

            {/* v12.6: Mobile Overlay */}
            {overlayState.isOpen && (
                <FullPageOverlay
                    title={overlayState.title}
                    content={overlayState.content}
                    controlsType={overlayState.controlsType}
                    onClose={() => setOverlayState({ ...overlayState, isOpen: false })}
                />
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
}



// v12.6: Full Page Overlay Component for Mobile Robustness
const FullPageOverlay = ({ title, onClose, content, controlsType }) => {
    // Inline Preach Controls State
    const [fontSize, setFontSize] = React.useState(22);
    const [isDark, setIsDark] = React.useState(false);
    const [isLocked, setIsLocked] = React.useState(false);
    const [timer, setTimer] = React.useState(0);
    const wakeLockRef = React.useRef(null);

    // Inline TTS Controls State
    const [voices, setVoices] = React.useState([]);
    const [selectedVoiceIndex, setSelectedVoiceIndex] = React.useState(0);
    const [isPlaying, setIsPlaying] = React.useState(false);
    const [isPaused, setIsPaused] = React.useState(false);

    // Refs for async callback safety (prevents GC and state staleness)
    const isPlayingRef = React.useRef(false);
    const utteranceRef = React.useRef(null);
    const audioCtxRef = React.useRef(null);

    // Text chunking refs for mobile compatibility (max 500 chars per chunk)
    const textChunksRef = React.useRef([]);
    const currentChunkRef = React.useRef(0);
    const fullTextRef = React.useRef('');
    const selectedLangRef = React.useRef('en-US');

    // TTS Voice Loading Effect with aggressive polling (mobile-compatible)
    React.useEffect(() => {
        if (controlsType !== 'tts') return;
        const synth = window.speechSynthesis;
        if (!synth) return;

        const loadVoices = () => {
            const allVoices = synth.getVoices();

            if (allVoices.length > 0) {
                // Filter for English and Afrikaans voices only
                let filtered = allVoices.filter(v =>
                    v.lang.startsWith('en') || v.lang.startsWith('af') || v.lang.startsWith('nl')
                );

                // If no English/Afrikaans voices, use all voices
                if (filtered.length === 0) {
                    filtered = allVoices;
                }

                setVoices(filtered);

                // Select best default voice (prefer English, then Afrikaans)
                const defaultVoice = filtered.find(v => v.lang.startsWith('en')) ||
                    filtered.find(v => v.lang.startsWith('af')) ||
                    filtered[0];
                if (defaultVoice) {
                    const idx = filtered.indexOf(defaultVoice);
                    setSelectedVoiceIndex(idx >= 0 ? idx : 0);
                }
            }
        };

        loadVoices();

        // Browser event for voice list updates
        if (synth.onvoiceschanged !== undefined) {
            synth.onvoiceschanged = loadVoices;
        }

        // AGGRESSIVE POLLING for mobile (same as AudioPlayer)
        let pollCount = 0;
        const timer = setInterval(() => {
            pollCount++;
            const currentVoices = synth.getVoices();
            if (currentVoices.length > 0) {
                loadVoices();
                clearInterval(timer);
                return;
            }
            if (pollCount >= 10) clearInterval(timer);
        }, 500);

        // SILENT PROBE to wake up speech engine on mobile
        setTimeout(() => {
            if (synth.getVoices().length <= 1) {
                const probe = new SpeechSynthesisUtterance(' ');
                probe.volume = 0;
                synth.speak(probe);
            }
        }, 300);

        return () => clearInterval(timer);
    }, [controlsType]);

    // Sync ref with state for use in async callbacks
    React.useEffect(() => {
        isPlayingRef.current = isPlaying;
    }, [isPlaying]);

    // TTS Control Handlers (mobile-compatible with Web Audio keep-alive)
    const handlePlay = () => {
        const synth = window.speechSynthesis;
        if (!synth) {
            return;
        }

        if (synth.speaking && !isPaused) {
            synth.pause();
            setIsPaused(true);
            setIsPlaying(false);
            isPlayingRef.current = false;
        } else if (isPaused) {
            synth.resume();
            setIsPaused(false);
            setIsPlaying(true);
            isPlayingRef.current = true;
        } else {
            // New playback - FIRST cancel any existing speech to prevent race condition
            synth.cancel();

            const iframe = document.getElementById('overlay-iframe');
            if (!iframe || !iframe.contentDocument) {
                return;
            }
            const contentEl = iframe.contentDocument.getElementById('tts-content');
            if (!contentEl) {
                return;
            }

            const text = contentEl.innerText;

            // Split text into chunks (max 500 chars each, try to break at sentence/word boundaries)
            const CHUNK_SIZE = 500;
            const chunks = [];
            let remaining = text;
            while (remaining.length > 0) {
                if (remaining.length <= CHUNK_SIZE) {
                    chunks.push(remaining);
                    break;
                }
                // Find a good break point (sentence end, period, or space)
                let breakAt = CHUNK_SIZE;
                const lastPeriod = remaining.lastIndexOf('.', CHUNK_SIZE);
                const lastSpace = remaining.lastIndexOf(' ', CHUNK_SIZE);
                if (lastPeriod > CHUNK_SIZE - 100) breakAt = lastPeriod + 1;
                else if (lastSpace > CHUNK_SIZE - 50) breakAt = lastSpace;

                chunks.push(remaining.substring(0, breakAt));
                remaining = remaining.substring(breakAt).trim();
            }

            textChunksRef.current = chunks;
            currentChunkRef.current = 0;
            fullTextRef.current = text;
            // Store selected language
            const voice = voices[selectedVoiceIndex];
            selectedLangRef.current = voice ? voice.lang : 'en-US';

            // Initialize Web Audio Context for Android keep-alive
            try {
                if (!audioCtxRef.current) {
                    const AudioContext = window.AudioContext || window.webkitAudioContext;
                    if (AudioContext) {
                        const ctx = new AudioContext();
                        const osc = ctx.createOscillator();
                        const gain = ctx.createGain();
                        osc.type = 'sine';
                        osc.frequency.setValueAtTime(15000, ctx.currentTime);
                        gain.gain.setValueAtTime(0.001, ctx.currentTime);
                        osc.connect(gain);
                        gain.connect(ctx.destination);
                        osc.start();
                        audioCtxRef.current = ctx;
                    }
                }
                if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
                    audioCtxRef.current.resume();
                }
            } catch (e) {
                console.warn('Web Audio error:', e);
            }

            // Request Screen Wake Lock to keep screen on during playback
            if ('wakeLock' in navigator) {
                navigator.wakeLock.request('screen')
                    .then(lock => {
                        wakeLockRef.current = lock;
                    })
                    .catch(e => console.warn('Wake Lock error:', e));
            }

            // Start speaking first chunk
            speakCurrentChunk();
        }
    };

    // Helper function to speak the current chunk
    const speakCurrentChunk = () => {
        const synth = window.speechSynthesis;
        const chunks = textChunksRef.current;
        const idx = currentChunkRef.current;

        if (idx >= chunks.length) {
            setIsPlaying(false);
            setIsPaused(false);
            isPlayingRef.current = false;
            // Release Wake Lock and suspend Web Audio
            if (wakeLockRef.current) {
                wakeLockRef.current.release().catch(() => { });
                wakeLockRef.current = null;
            }
            if (audioCtxRef.current && audioCtxRef.current.state === 'running') {
                audioCtxRef.current.suspend();
            }
            return;
        }

        const chunkText = chunks[idx];

        const utterance = new SpeechSynthesisUtterance(chunkText);
        utterance.lang = selectedLangRef.current;
        utterance.rate = 0.95;

        // Keep reference to prevent GC
        window._activeUtterance = utterance;
        utteranceRef.current = utterance;

        utterance.onstart = () => {
            setIsPlaying(true);
            setIsPaused(false);
            isPlayingRef.current = true;
        };

        utterance.onend = () => {
            // Move to next chunk
            currentChunkRef.current = idx + 1;
            if (isPlayingRef.current) {
                // Small delay between chunks
                setTimeout(() => {
                    if (isPlayingRef.current) {
                        speakCurrentChunk();
                    }
                }, 50);
            }
        };

        utterance.onerror = (e) => {
            if (e.error !== 'interrupted' && e.error !== 'canceled') {
                setIsPlaying(false);
                setIsPaused(false);
                isPlayingRef.current = false;
            }
        };

        // Speak with delay
        setTimeout(() => {
            if (isPlayingRef.current || idx === 0) {
                synth.speak(utterance);
            }
        }, idx === 0 ? 100 : 30);
    };

    const handleStop = () => {
        window.speechSynthesis.cancel();
        setIsPlaying(false);
        setIsPaused(false);
        isPlayingRef.current = false;
        // Suspend Web Audio to save resources
        if (audioCtxRef.current && audioCtxRef.current.state === 'running') {
            audioCtxRef.current.suspend();
        }
        // Release Wake Lock
        if (wakeLockRef.current) {
            wakeLockRef.current.release().catch(() => { });
            wakeLockRef.current = null;
        }
    };

    const handleCopy = async () => {
        const iframe = document.getElementById('overlay-iframe');
        if (!iframe || !iframe.contentDocument) {
            alert('Cannot access content');
            return;
        }
        const contentEl = iframe.contentDocument.getElementById('tts-content');
        if (!contentEl) {
            alert('Content not found');
            return;
        }

        const text = contentEl.innerText;

        // Try modern clipboard API first
        if (navigator.clipboard && navigator.clipboard.writeText) {
            try {
                await navigator.clipboard.writeText(text);
                alert('Copied!');
                return;
            } catch (e) {
                // Fall through to legacy method
            }
        }

        // Fallback: Create temporary textarea and use execCommand
        try {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.left = '-9999px';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            alert('Copied!');
        } catch (e) {
            alert('Copy failed. Please select and copy manually.');
        }
    };

    // Timer Effect
    React.useEffect(() => {
        if (controlsType !== 'preach') return;
        const interval = setInterval(() => setTimer(t => t + 1), 1000);
        return () => clearInterval(interval);
    }, [controlsType]);

    // Wake Lock Effect
    React.useEffect(() => {
        if (controlsType !== 'preach') return;
        const requestLock = async () => {
            try {
                if ('wakeLock' in navigator) {
                    wakeLockRef.current = await navigator.wakeLock.request('screen');
                    setIsLocked(true);
                }
            } catch (e) { console.error('Lock failed', e); }
        };
        requestLock();
        return () => { if (wakeLockRef.current) wakeLockRef.current.release(); };
    }, [controlsType]);

    const formatTime = (s) => {
        const m = Math.floor(s / 60).toString().padStart(2, '0');
        const sec = (s % 60).toString().padStart(2, '0');
        return `${m}:${sec}`;
    };

    const updateIframeStyle = (property, value) => {
        const iframe = document.getElementById('overlay-iframe');
        if (iframe && iframe.contentDocument) {
            iframe.contentDocument.documentElement.style.setProperty(property, value);
        }
    };

    const handleFont = (delta) => {
        const newSize = Math.max(16, Math.min(42, fontSize + delta));
        setFontSize(newSize);
        updateIframeStyle('--font-size', newSize + 'px');
    };

    const handleTheme = () => {
        const newDark = !isDark;
        setIsDark(newDark);
        if (newDark) {
            updateIframeStyle('--bg-color', '#121212');
            updateIframeStyle('--text-color', '#e5e5e5');
            updateIframeStyle('--highlight-color', '#3f2e00');
            updateIframeStyle('--accent-color', '#a78bfa');
        } else {
            updateIframeStyle('--bg-color', '#ffffff');
            updateIframeStyle('--text-color', '#121212');
            updateIframeStyle('--highlight-color', '#fef9c3');
            updateIframeStyle('--accent-color', '#7c3aed');
        }
    };

    const handleLock = async () => {
        if (!isLocked) {
            try {
                if ('wakeLock' in navigator) {
                    wakeLockRef.current = await navigator.wakeLock.request('screen');
                    setIsLocked(true);
                }
            } catch (e) { console.error('Lock failed', e); alert('Wake Lock failed: ' + e.message); }
        } else {
            if (wakeLockRef.current) {
                await wakeLockRef.current.release();
                wakeLockRef.current = null;
            }
            setIsLocked(false);
        }
    };

    const btnStyle = {
        background: 'transparent',
        border: '1px solid rgba(255,255,255,0.2)',
        color: 'white',
        width: '44px',
        height: '44px',
        borderRadius: '50%',
        fontSize: '20px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100dvh', // Use dynamic viewport height for mobile Safari
            zIndex: 99999,
            background: '#0f172a',
            display: 'flex',
            flexDirection: 'column'
        }}>
            <div style={{
                height: 'calc(60px + env(safe-area-inset-top, 0px))',
                background: '#1e293b',
                borderBottom: '1px solid #334155',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'env(safe-area-inset-top, 0px) 15px 0 15px',
                flexShrink: 0,
                zIndex: 100001
            }}>
                <span style={{ color: '#f8fafc', fontWeight: 'bold', fontSize: '1.1rem' }}>{title}</span>
                <button
                    onClick={onClose}
                    style={{
                        padding: '8px 16px',
                        background: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '14px'
                    }}
                >
                    ✕ {title === 'Teks na Spraak' || title === 'Text to Speech' ? 'STOP' : 'CLOSE'}
                </button>
            </div>

            {/* Lifted Controls Layer - Preach Mode */}
            {controlsType === 'preach' && (
                <div style={{
                    position: 'fixed',
                    bottom: 'calc(20px + env(safe-area-inset-bottom, 0px))', // Account for iOS home indicator
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 100002,
                    display: 'flex',
                    gap: '12px',
                    background: 'rgba(15, 23, 42, 0.95)',
                    backdropFilter: 'blur(12px)',
                    padding: '12px 24px',
                    borderRadius: '50px',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    width: 'max-content',
                    maxWidth: '95vw',
                    flexWrap: 'wrap',
                    justifyContent: 'center'
                }}>
                    <button style={btnStyle} onClick={() => handleFont(-2)}>A-</button>
                    <div style={{ color: 'white', fontWeight: 'bold', fontSize: '18px', minWidth: '60px', textAlign: 'center', alignSelf: 'center' }}>
                        {formatTime(timer)}
                    </div>
                    <button style={btnStyle} onClick={() => handleFont(2)}>A+</button>
                    <button style={btnStyle} onClick={handleTheme}>{isDark ? '🌙' : '☀️'}</button>
                    <button style={{ ...btnStyle, color: isLocked ? '#4ade80' : '#6b7280', borderColor: isLocked ? '#4ade80' : 'rgba(255,255,255,0.2)' }} onClick={handleLock}>
                        {isLocked ? '🔒' : '🔓'}
                    </button>
                </div>
            )}

            {/* Lifted Controls Layer - TTS Mode */}
            {controlsType === 'tts' && (
                <div style={{
                    position: 'fixed',
                    bottom: '20px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 100002,
                    display: 'flex',
                    gap: '12px',
                    background: 'rgba(15, 23, 42, 0.95)',
                    backdropFilter: 'blur(12px)',
                    padding: '12px 24px',
                    borderRadius: '50px',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    width: 'max-content',
                    maxWidth: '95vw',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    alignItems: 'center'
                }}>
                    <select
                        style={{
                            background: '#334155', color: 'white', border: '1px solid #475569',
                            borderRadius: '12px', padding: '8px 12px', outline: 'none', maxWidth: '250px', fontSize: '14px'
                        }}
                        value={selectedVoiceIndex}
                        onChange={(e) => setSelectedVoiceIndex(Number(e.target.value))}
                    >
                        {voices.map((v, i) => {
                            const langCode = v.lang.split('-')[0].toUpperCase();
                            return (
                                <option key={i} value={i}>
                                    [{langCode}] {v.name.replace('Microsoft ', '').replace('Desktop', '')}
                                </option>
                            );
                        })}
                    </select>

                    <button
                        style={{ background: '#f59e0b', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '25px', fontWeight: '700', fontSize: '15px', cursor: 'pointer' }}
                        onClick={handlePlay}
                    >
                        {isPlaying && !isPaused ? '⏸️ Pause' : (isPaused ? '▶️ Resume' : '▶️ Play')}
                    </button>

                    <button
                        style={{ background: '#64748b', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '25px', fontWeight: '700', fontSize: '15px', cursor: 'pointer' }}
                        onClick={handleStop}
                        disabled={!isPlaying && !isPaused}
                    >
                        ⏹️
                    </button>

                    <button
                        style={{ background: '#10b981', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '25px', fontWeight: '700', fontSize: '15px', cursor: 'pointer' }}
                        onClick={handleCopy}
                    >
                        📋 Copy
                    </button>
                </div>
            )}

            <iframe
                id="overlay-iframe"
                title="overlay-content"
                style={{
                    flex: 1,
                    width: '100%',
                    border: 'none',
                    background: 'white',
                    marginBottom: controlsType ? '120px' : '0' // Increased margin to ensure content clears floating controls
                }}
                srcDoc={content}
                allow="screen-wake-lock; clipboard-write; clipboard-read"
            />
        </div>
    );
};

