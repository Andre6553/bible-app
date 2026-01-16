import { supabase } from '../config/supabaseClient';
import { AFRIKAANS_BOOK_NAMES } from '../constants/bookNames';
import { notifyAdminOfNewUser } from './emailService';
import { logEvent } from './analyticsService';

/**
 * Bible Service - Handles all Bible data operations with Supabase
 */

export const SUPPORTED_VERSIONS = [
    { id: 'AFR53', name: 'Afrikaans 1953', abbreviation: 'AFR53', language: 'af' },
    { id: 'KJV', name: 'King James Version', abbreviation: 'KJV', language: 'en' },
    { id: 'NKJV', name: 'New King James Version', abbreviation: 'NKJV', language: 'en' },
    { id: 'NIV', name: 'New International Version', abbreviation: 'NIV', language: 'en' },
    { id: 'ESV', name: 'English Standard Version', abbreviation: 'ESV', language: 'en' },
    { id: 'NLT', name: 'New Living Translation', abbreviation: 'NLT', language: 'en' },
    { id: 'AMP', name: 'Amplified Bible', abbreviation: 'AMP', language: 'en' },
    { id: 'AFR83', name: 'Afrikaans 1983', abbreviation: 'AFR83', language: 'af' },
    { id: 'AFRNLV', name: 'Afrikaanse Nuwe Lewe', abbreviation: 'AFR NLV', language: 'af' },
    { id: 'XHO22', name: 'Xhosa 2022', abbreviation: 'XHO22', language: 'xh' },
];

/**
 * Get all available Bible versions
 */
export const getVersions = async () => {
    // Return hardcoded list as per requirements/schema limitations
    return { success: true, data: SUPPORTED_VERSIONS };
};

/**
 * Get all books grouped by testament
 */
export const getBooks = async () => {
    try {
        const { data, error } = await supabase
            .from('books')
            .select('*')
            .order('order'); // specified as 'order' in prompt

        if (error) throw error;

        // Group by testament
        const oldTestament = data.filter(book => book.testament === 'OT');
        const newTestament = data.filter(book => book.testament === 'NT');

        return {
            success: true,
            data: {
                oldTestament,
                newTestament,
                all: data
            }
        };
    } catch (error) {
        console.error('Error fetching books:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get a specific chapter with all verses
 * Caches the last 10 opened chapters in localStorage
 * Also checks IndexedDB for offline downloaded versions
 */
export const getChapter = async (bookId, chapter, versionId = 'KJV') => {
    const cacheKey = `chapter_${bookId}_${chapter}_${versionId}`;

    // [NEW] Log Bible reading activity (Always log, even on cache hits)
    logEvent('view_bible_chapter', {
        book_id: bookId,
        chapter: chapter,
        version_id: versionId
    });

    // 1. Try to get from cache first
    try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            console.log('Serving chapter from cache');
            return { success: true, data: JSON.parse(cached) };
        }
    } catch (e) {
        console.warn('Error reading from localStorage', e);
    }

    // 2. Check IndexedDB for offline version
    try {
        const { getOfflineChapter } = await import('./offlineService');
        const offlineData = await getOfflineChapter(bookId, chapter, versionId);
        if (offlineData && offlineData.length > 0) {
            console.log('📴 Serving chapter from offline storage');
            return { success: true, data: offlineData };
        }
    } catch (e) {
        console.warn('Error checking offline storage', e);
    }

    // 3. Fetch from network
    try {
        const { data, error } = await supabase
            .from('verses')
            .select(`
                id,
                book_id,
                chapter,
                verse,
                text,
                version,
                red_letters,
                books (
                    id,
                    name_full,
                    testament
                )
            `)
            .eq('book_id', bookId)
            .eq('chapter', chapter)
            .eq('version', versionId) // Using string column
            .order('verse');

        if (error) throw error;

        // 3. Save to cache if successful
        if (data && data.length > 0) {
            try {
                // Save content
                localStorage.setItem(cacheKey, JSON.stringify(data));

                // Update recent chapters list to maintain limit of 10
                const recentKeysStr = localStorage.getItem('recentChapters');
                let recentKeys = recentKeysStr ? JSON.parse(recentKeysStr) : [];

                // Remove this key if it already exists (to move it to top)
                recentKeys = recentKeys.filter(k => k !== cacheKey);

                // Add to beginning
                recentKeys.unshift(cacheKey);

                // Trim to 10
                if (recentKeys.length > 10) {
                    const removedKeys = recentKeys.splice(10);
                    // Remove old data from localStorage
                    removedKeys.forEach(k => localStorage.removeItem(k));
                }

                localStorage.setItem('recentChapters', JSON.stringify(recentKeys));
            } catch (e) {
                console.warn('Error saving to localStorage', e);
            }
        }

        return { success: true, data };
    } catch (error) {
        console.error('Error fetching chapter:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get chapter count for a specific book
 */
export const getChapterCount = async (bookId) => {
    try {
        // We can find the max chapter number for a book
        // Since we don't have a chapters table, we query verses
        // This is a bit heavy but works for this schema
        const { data, error } = await supabase
            .from('verses')
            .select('chapter')
            .eq('book_id', bookId)
            .order('chapter', { ascending: false })
            .limit(1);

        if (error) throw error;
        return {
            success: true,
            data: data.length > 0 ? data[0].chapter : 0
        };
    } catch (error) {
        console.error('Error fetching chapter count:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get verse count for a specific chapter
 */
export const getVerseCount = async (bookId, chapter) => {
    try {
        const { data, error } = await supabase
            .from('verses')
            .select('verse')
            .eq('book_id', bookId)
            .eq('chapter', chapter)
            .order('verse', { ascending: false })
            .limit(1);

        if (error) throw error;
        return {
            success: true,
            data: data.length > 0 ? data[0].verse : 0
        };
    } catch (error) {
        console.error('Error fetching verse count:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Search verses by keyword or phrase
 */
export const searchVerses = async (searchQuery, versionId = null, testament = 'all') => {
    try {
        // Use !inner join if we need to filter by testament, otherwise standard join
        const bookJoin = testament !== 'all' ? 'books!inner' : 'books';
        const terms = searchQuery.split(',').map(t => t.trim()).filter(t => t.length > 0);

        let query = supabase
            .from('verses')
            .select(`
                id,
                book_id,
                chapter,
                verse,
                text,
                version,
                red_letters,
                ${bookJoin} (
                    id,
                    name_full,
                    testament
                )
            `);

        if (terms.length > 0) {
            // Use textSearch for exact word/token matching
            // Logic:
            // 1. Comma separated terms are OR'd (|)
            // 2. Space separated words within a term are AND'd/followed-by (<->) for phrases
            // 3. Config 'simple' ensures exact matching without language-specific stemming

            const tsQuery = terms.map(term => {
                // Split phrase into words, sanitize quotes, wrapp in quotes
                return term.split(/\s+/)
                    .map(w => w.replace(/['"]/g, '')) // Remove quotes to prevent syntax errors
                    .filter(w => w.length > 0)
                    .map(w => `'${w}'`)
                    .join(' <-> ');
            }).join(' | ');

            query = query.textSearch('text', tsQuery, {
                config: 'simple',
                type: 'plain' // actually we constructed the query string manually, so we don't need 'plain' or 'websearch' type if we pass explicit syntax? 
                // Wait, Supabase client documentation: textSearch(column, query, options)
                // If options.type is not set, it treats query as tsquery.
                // So we should NOT set type: 'plain' if we are sending 'foo' | 'bar'.
            });
            // Re-correcting: omit 'type' to use manual TSQuery syntax
            query = query.textSearch('text', tsQuery, { config: 'simple' });
        }

        query = query.order('book_id')
            .order('chapter')
            .order('verse')
            .limit(1000);

        // Filter by version if specified, otherwise search all
        if (versionId && versionId !== 'all') {
            query = query.eq('version', versionId);
        }

        // Filter by testament
        if (testament && testament !== 'all') {
            query = query.eq('books.testament', testament);
        }

        const { data, error } = await query;

        if (error) throw error;

        // Log search asynchronously
        logSearch(searchQuery, versionId, testament);

        return { success: true, data };
    } catch (error) {
        console.error('Error searching verses:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get verse reference text (book name, chapter:verse)
 */
export const getVerseReference = (verse) => {
    if (!verse || !verse.books) return '';
    return `${verse.books.name_full} ${verse.chapter}:${verse.verse}`;
};

// Simple memory cache
let cachedUserId = null;

// Clear cache on auth change
supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
        cachedUserId = null;
    } else if (session?.user) {
        cachedUserId = session.user.id;
    }
});

// Session-level initialization flag
let isSessionInitialized = false;

/**
 * Get current User ID (Auth user if logged in, otherwise anonymous local ID)
 */
export const getUserId = async () => {
    try {
        // Always try to get a fresh session first to avoid race conditions
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
            const userId = session.user.id;
            cachedUserId = userId; // Update memory cache

            // Clean up guest ID if it exists
            if (localStorage.getItem('bible_user_id')) {
                localStorage.removeItem('bible_user_id');
            }

            // Per-session initialization for authenticated users
            if (!isSessionInitialized) {
                isSessionInitialized = true;
                initializeNewUser(userId).catch(err => console.error('[Auth] Init failed:', err));

                // Sync profile metadata
                const email = session.user.email;
                supabase.from('user_profiles').upsert({
                    user_id: userId,
                    email: email,
                    last_seen: new Date().toISOString()
                }, { onConflict: 'user_id' }).then(({ error }) => {
                    if (error) console.warn('[ProfileSync] Error:', error.message);
                });
            }

            return userId;
        }
    } catch (e) {
        console.warn('[Auth] Session check failed:', e);
    }

    // Fallback to memory cache
    if (cachedUserId) return cachedUserId;

    // Fallback to guest ID in localStorage
    let guestId = localStorage.getItem('bible_user_id');
    if (!guestId) {
        guestId = 'user_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
        localStorage.setItem('bible_user_id', guestId);
    }

    cachedUserId = guestId;

    // Per-session initialization for guests
    if (!isSessionInitialized) {
        isSessionInitialized = true;
        initializeNewUser(guestId).catch(err => console.error('[Auth] Guest init failed:', err));
    }

    return guestId;
};

/**
 * Initialize a new user (Internal Logic)
 * Checks if 'super_users_auto' is enabled and adds user if true.
 */
const initializeNewUser = async (userId) => {
    if (!userId) return;

    try {
        const { data: settings, error } = await supabase
            .from('app_settings')
            .select('key, value')
            .in('key', ['super_users_auto', 'blog_rate_limit_enabled', 'super_users']);

        if (error) return;

        const autoSuperOn = settings.find(s => s.key === 'super_users_auto')?.value === 'true';
        const currentListData = settings.find(s => s.key === 'super_users');

        if (!autoSuperOn) return;

        let currentUsers = [];
        if (currentListData?.value) {
            try {
                currentUsers = JSON.parse(currentListData.value);
            } catch (e) { }
        }

        if (currentUsers.includes(userId)) return;

        console.log('✨ Auto-Promotion triggered: Promoting user', userId);

        const newList = [...currentUsers, userId];
        const { error: upsertError } = await supabase
            .from('app_settings')
            .upsert({
                key: 'super_users',
                value: JSON.stringify(newList),
                updated_at: new Date().toISOString()
            });

        if (!upsertError) {
            console.log('✅ New user successfully auto-promoted to Super User');
        }
    } catch (err) { }
};

/**
 * Helper to get the IP address captured by SettingsContext
 */
const getCapturedIp = () => {
    try {
        return localStorage.getItem('captured_ip') || null;
    } catch (e) {
        return null;
    }
};

/**
 * Log search query for analytics
 */
export const logSearch = async (query, version, testament) => {
    try {
        const userId = await getUserId();
        const ipAddress = getCapturedIp();

        await supabase.from('search_logs').insert([
            {
                query,
                version: version || 'all',
                testament: testament || 'all',
                user_id: userId,
                device_info: navigator.userAgent,
                ip_address: ipAddress
            }
        ]);
    } catch (err) {
        // Silently fail
        console.error('Analytics log error', err);
    }
};

/**
 * Log generic app activity
 */
export const logActivity = async (activityType) => {
    try {
        if (!activityType) {
            console.warn('⚠️ logActivity called without activityType! Defaulting to "unknown_action". Trace:', new Error().stack);
            activityType = 'unknown_action';
        }

        const userId = await getUserId();

        // Don't log repeats for simple page visits within short timeframe (optional optimization)
        // ...

        const { error } = await supabase.from('user_activity_logs').insert({
            user_id: userId,
            activity_type: activityType,
            // details: {}, // Removed due to missing schema column
            ip_address: getCapturedIp(),
            created_at: new Date().toISOString()
        });

        if (error) throw error;
    } catch (err) {
        console.error('Error logging activity:', err);
    }
};

/**
 * Get User Statistics (Total Users, Most Active)
 */
export const getUserStatistics = async () => {
    try {
        // 1. Try Global RPC (Secure Global Data)
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_global_user_stats_v5');

        if (rpcError) {
            // If it's a 404 (Not Found), it means the function doesn't exist.
            // We ignore this and let the fallback logic below take over.
            if (rpcError.code !== 'PGRST116' && rpcError.status !== 404) {
                console.warn('RPC Stats Error:', rpcError);
            }
        }

        if (!rpcError && rpcData) {
            const users = rpcData.users || [];
            const mappedUsers = users.map(u => ({
                userId: u.user_id,
                email: u.email,
                count: (u.search_count || 0) + (u.ai_count || 0) + (u.sermon_count || 0),
                devices: u.device ? [u.device] : [],
                device: u.device || 'Unknown',
                displayId: u.email || u.user_id,
                lastSeen: u.last_seen,
                originalIds: [u.user_id] // Helper for existing logic
            }));

            // Calculate global activity counts for the chart
            const globalActivityCounts = {
                search: 0,
                ai: 0,
                sermon_creation: 0,
                total: 0
            };

            users.forEach(u => {
                globalActivityCounts.search += (u.search_count || 0);
                globalActivityCounts.ai += (u.ai_count || 0);
                globalActivityCounts.sermon_creation += (u.sermon_count || 0);
            });
            globalActivityCounts.total = globalActivityCounts.search + globalActivityCounts.ai + globalActivityCounts.sermon_creation;

            // [NEW] Fetch Subscription Status via SECURE RPC (Bypasses RLS for Admins)
            const userIds = users.map(u => u.user_id);
            const { data: profiles, error: profileError } = await supabase
                .rpc('get_user_profiles_secure', { user_ids: userIds });

            if (profileError) console.error('❌ Error fetching secure profiles:', profileError);
            console.log('🔍 Secure Profiles Fetched:', profiles ? profiles.length : 0, profiles);

            const subMap = {};
            if (profiles) {
                profiles.forEach(p => {
                    subMap[p.user_id] = {
                        isSubscriber: (
                            p.subscription_tier === 'premium' ||
                            p.subscription_override === 'premium' ||
                            p.subscription_override === 'admin' ||
                            p.subscription_override === 'tester' ||
                            p.subscription_override === 'tester_finger' ||
                            (p.subscription_expiry && new Date(p.subscription_expiry) > new Date())
                        ),
                        subscription_override: p.subscription_override,
                        subscription_tier: p.subscription_tier
                    };
                });
            }

            const finalUsers = mappedUsers.map(u => ({
                ...u,
                isSubscriber: subMap[u.userId]?.isSubscriber || false,
                subscription_override: subMap[u.userId]?.subscription_override,
                subscription_tier: subMap[u.userId]?.subscription_tier
            }));

            return {
                success: true,
                data: {
                    totalUsers: rpcData.total || 0,
                    topUsers: finalUsers,
                    globalActivityCounts: globalActivityCounts
                }
            };
        }

        // 2. Fallback (Legacy Client-side Fetch)
        // 1. Fetch search and AI logs (latest 5000 for each to get a representative active set)
        const searchReq = supabase.from('search_logs').select('user_id, device_info').order('created_at', { ascending: false }).limit(5000);
        const aiReq = supabase.from('ai_questions').select('user_id, device_info').order('created_at', { ascending: false }).limit(5000);
        const blogReq = supabase.from('blog_views').select('user_id, device_info').order('created_at', { ascending: false }).limit(5000);
        const readingReq = supabase.from('bible_reading_logs').select('user_id, device_info').order('created_at', { ascending: false }).limit(5000);
        const activityReq = supabase.from('user_activity_logs').select('user_id, device_info').order('created_at', { ascending: false }).limit(5000);

        const [searchRes, aiRes, blogRes, readingRes, activityRes] = await Promise.all([searchReq, aiReq, blogReq, readingReq, activityReq]);

        if (searchRes.error) throw searchRes.error;
        if (aiRes.error) throw aiRes.error;
        if (blogRes.error) throw blogRes.error;
        if (readingRes.error) throw readingRes.error;
        // Don't throw for activityRes.error as it's a new table that might not exist yet

        // Combined list of all actions
        const allActions = [
            ...(searchRes.data || []).map(d => ({ user: d.user_id, type: 'search', device: d.device_info })),
            ...(aiRes.data || []).map(d => ({ user: d.user_id, type: 'ai', device: d.device_info })),
            ...(blogRes.data || []).map(d => ({ user: d.user_id, type: 'blog', device: d.device_info })),
            ...(readingRes.data || []).map(d => ({ user: d.user_id, type: 'bible', device: d.device_info })),
            ...(activityRes.data || []).map(d => ({ user: d.user_id, type: 'activity', device: d.device_info }))
        ];

        // Extract unique user IDs for profile fetching
        const uniqueUserIds = [...new Set(allActions.map(a => a.user).filter(u => u && u !== 'Anonymous' && u !== 'undefined'))];

        // [SECURE FETCH] Fetch profiles using the RPC to bypass RLS for admins
        const { data: profileData } = await supabase.rpc('get_user_profiles_secure', { user_ids: uniqueUserIds });

        // Map userId to email for quick lookup
        const profileMap = {};
        if (profileData) {
            profileData.forEach(p => {
                profileMap[p.user_id] = p.email;
            });
        }


        // 2. User Activity Count & Device Parsing
        const userStats = {};

        // Initialize userStats with ALL users from user_profiles first
        if (profileData) {
            profileData.forEach(p => {
                const identity = p.email || p.user_id;
                if (!userStats[identity]) {
                    userStats[identity] = {
                        count: 0,
                        devices: [],
                        email: p.email || null,
                        last_ip: p.last_ip || null,
                        originalIds: new Set(),
                        isSubscriber: false
                    };
                }
                userStats[identity].originalIds.add(p.user_id);

                // Check premium status
                const isPremium = p.subscription_tier === 'premium' ||
                    p.subscription_override === 'premium' ||
                    p.subscription_override === 'admin' ||
                    p.subscription_override === 'tester' ||
                    p.subscription_override === 'tester_finger' ||
                    (p.subscription_expiry && new Date(p.subscription_expiry) > new Date());

                if (isPremium) userStats[identity].isSubscriber = true;

                // [NEW] Capture detailed roles for admin UI
                userStats[identity].subscription_override = p.subscription_override;
                userStats[identity].subscription_tier = p.subscription_tier;
            });
        }

        allActions.forEach(action => {
            const uid = action.user;
            if (!uid || uid === 'Anonymous' || uid === 'undefined') return;

            // Determine the "identity" of this user - if they have an email, use it to group
            const identity = profileMap[uid] || uid;

            if (!userStats[identity]) {
                // [FIX] If the profile is missing AND this isn't an email we already know,
                // we should check if they even have a valid existence in profileRes.data.
                // If they are not in the profile table, they are likely deleted - IGNORE THEM.
                if (!profileMap[uid]) return;

                userStats[identity] = {
                    count: 0,
                    devices: [],
                    email: profileMap[uid] || null,
                    originalIds: new Set()
                };
            }
            userStats[identity].count++;
            userStats[identity].originalIds.add(uid);
            if (action.device) {
                userStats[identity].devices.push(action.device);
            }
        });

        // Unique users count: Only count identities that actually have a profile or meaningful activity
        // We filter out any 'undefined' or empty identities just in case
        const validIdentities = Object.keys(userStats).filter(id => id && id !== 'undefined' && id !== 'null');
        const totalUniqueUsers = validIdentities.length;

        // Helper to get formatted device name
        const getDeviceName = (userAgents) => {
            if (!userAgents || userAgents.length === 0) return 'Unknown';
            // Use the most common device type
            const counts = userAgents.reduce((acc, ua) => {
                let type = '❓ Unknown';
                if (/iPhone|iPad|iPod/.test(ua)) type = '📱 iOS';
                else if (/Android/.test(ua)) type = '📱 Android';
                else if (/Windows/.test(ua)) type = '💻 Windows';
                else if (/Macintosh|Mac OS X/.test(ua)) type = '💻 Mac';
                else if (/Linux/.test(ua)) type = '🐧 Linux';
                acc[type] = (acc[type] || 0) + 1;
                return acc;
            }, {});

            return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
        };

        // 3. Sort by activity (but keep 0 count users)
        const topUsers = validIdentities
            .map(id => ({
                userId: id, // Identity (email or ID)
                email: userStats[id].email,
                last_ip: userStats[id].last_ip,
                displayId: userStats[id].email || id,
                count: userStats[id].count,
                device: getDeviceName(userStats[id].devices),
                originalIds: Array.from(userStats[id].originalIds), // Keep original IDs for deep filtering
                isSubscriber: userStats[id].isSubscriber || false
            }))
            .sort((a, b) => b.count - a.count); // Sort by activity count

        /**
         * Get distribution of all user activities for global chart
         */
        const getGlobalActivityCounts = async () => {
            try {
                // 1. Get raw AI logs to parse types
                const { data: aiLogs, error: aiError } = await supabase
                    .from('ai_questions')
                    .select('question'); // We need the text to categorize

                // 2. Get Bible reading count
                const { count: bibleCount, error: bibleError } = await supabase
                    .from('bible_reading_logs')
                    .select('id', { count: 'exact', head: true });

                // 3. Get generic activity logs
                const { data: activityLogs, error: activityError } = await supabase
                    .from('user_activity_logs')
                    .select('activity_type');

                if (aiError || bibleError || activityError) throw new Error('Failed to fetch stats');

                const counts = {
                    bible: bibleCount || 0,
                    ai: 0,
                    search: 0,
                    // Granular AI types
                    inductive_hint_1: 0,
                    inductive_hint_2: 0,
                    inductive_hint_3: 0,
                    word_study_ai: 0,
                    semantic_search: 0
                };

                // Parse AI Logs
                (aiLogs || []).forEach(log => {
                    const q = log.question || '';
                    if (q.startsWith('Inductive Hint Step 1')) {
                        counts.inductive_hint_1++;
                    } else if (q.startsWith('Inductive Hint Step 2')) {
                        counts.inductive_hint_2++;
                    } else if (q.startsWith('Inductive Hint Step 3')) {
                        counts.inductive_hint_3++;
                    } else if (q.startsWith('Word Study:')) {
                        counts.word_study_ai++;
                    } else if (q.startsWith('Semantic Search:')) {
                        counts.semantic_search++;
                    } else {
                        counts.ai++; // Generic AI
                    }
                });

                // Parse Generic Activity Logs
                (activityLogs || []).forEach(log => {
                    const type = log.activity_type || 'uncategorized';
                    // Search is special (Legacy: search logs might be separate, but we aren't fetching search_logs table count here anymore? 
                    // Wait, previous code fetched search_logs count. Let's restore that.)
                    counts[type] = (counts[type] || 0) + 1;
                });

                // 4. Get Search Logs count separately (Legacy Search)
                const { count: searchCount } = await supabase
                    .from('search_logs')
                    .select('id', { count: 'exact', head: true });

                // 5. Get Sermon Count (Use Global RPC helper to match the list)
                const globalSermonStats = await getGlobalSermonStats();
                const sermonCount = globalSermonStats.reduce((sum, s) => sum + s.count, 0);

                counts.search = (counts.search || 0) + (searchCount || 0);
                counts.sermon_creation = sermonCount || 0;

                return { success: true, data: counts };
            } catch (err) {
                console.error('Error getting global activity:', err);
                return { success: false, data: {} };
            }
        };
        const { data: globalActivityCounts } = await getGlobalActivityCounts();

        return {
            success: true,
            data: {
                totalUsers: totalUniqueUsers,
                topUsers: topUsers,
                globalActivityCounts: globalActivityCounts
            }
        };
    } catch (error) {
        console.error('Error getting user stats:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get specific history for a user
 */
export const getUserHistory = async (userId) => {
    try {
        const cleanUserId = userId?.trim();
        if (!cleanUserId) return { success: false, searches: [], aiQuestions: [] };

        let userIdsToFetch = [cleanUserId];

        // If this ID looks like an email, find all linked IDs
        if (cleanUserId.includes('@')) {
            const { data: profiles } = await supabase
                .from('user_profiles')
                .select('user_id')
                .eq('email', cleanUserId);

            if (profiles && profiles.length > 0) {
                userIdsToFetch = profiles.map(p => p.user_id);
            }
        }

        // 1. Query by all associated IDs
        const searchReq = supabase
            .from('search_logs')
            .select('*')
            .in('user_id', userIdsToFetch)
            .order('created_at', { ascending: false })
            .limit(1000);

        const aiReq = supabase
            .from('ai_questions')
            .select('*')
            .in('user_id', userIdsToFetch)
            .order('created_at', { ascending: false })
            .limit(1000);

        const blogReq = supabase
            .from('blog_views')
            .select('*')
            .in('user_id', userIdsToFetch)
            .order('created_at', { ascending: false })
            .limit(1000);

        const readingReq = supabase
            .from('bible_reading_logs')
            .select('*') // No join here, much safer
            .in('user_id', userIdsToFetch)
            .order('created_at', { ascending: false })
            .limit(1000);

        const activityReq = supabase
            .from('user_activity_logs')
            .select('*')
            .in('user_id', userIdsToFetch)
            .order('created_at', { ascending: false })
            .limit(1000);

        const sermonCountReq = (async () => {
            // Sermons table user_id is likely UUID, so filter out non-UUIDs to avoid 400 errors
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            const validUuids = userIdsToFetch.filter(id => uuidRegex.test(id));

            if (validUuids.length === 0) return { count: 0 };

            return await supabase
                .from('sermons')
                .select('id', { count: 'exact', head: true })
                .in('user_id', validUuids);
        })();

        const [searchRes, aiRes, blogRes, readingRes, activityRes, sermonCountRes] = await Promise.all([searchReq, aiReq, blogReq, readingReq, activityReq, sermonCountReq]);

        let searches = searchRes.data || [];
        let aiQuestions = aiRes.data || [];
        let blogViews = blogRes.data || [];
        let bibleReadings = readingRes.data || [];
        let activities = activityRes.data || [];
        let sermonCount = sermonCountRes.count || 0;

        // 2. Fallback: If no results, try client-side filtering (handles potential column type casting issues)
        if (searches.length === 0) {
            console.log(`Direct search_logs query returned 0 for ${cleanUserId}, trying fallback (limit 5000)...`);
            const { data: allSearches } = await supabase
                .from('search_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(5000); // Increased to match stats limit

            if (allSearches) {
                // Manual loose comparison
                searches = allSearches.filter(s => s.user_id && s.user_id.trim() === cleanUserId).slice(0, 1000);
                console.log(`Fallback found ${searches.length} searches`);
            }
        }

        if (aiQuestions.length === 0) {
            console.log(`Direct ai_questions query returned 0 for ${cleanUserId}, trying fallback (limit 5000)...`);
            const { data: allAi } = await supabase
                .from('ai_questions')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(5000);

            if (allAi) {
                aiQuestions = allAi.filter(q => q.user_id && q.user_id.trim() === cleanUserId).slice(0, 1000);
                console.log(`Fallback found ${aiQuestions.length} ai questions`);
            }
        }

        if (blogViews.length === 0) {
            console.log(`Direct blog_views query returned 0 for ${cleanUserId}, trying fallback (limit 5000)...`);
            const { data: allBlog } = await supabase
                .from('blog_views')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(5000);

            if (allBlog) {
                blogViews = allBlog.filter(b => b.user_id && b.user_id.trim() === cleanUserId).slice(0, 1000);
                console.log(`Fallback found ${blogViews.length} blog views`);
            }
        }

        if (bibleReadings.length === 0) {
            console.log(`Direct bible_reading_logs query returned 0 for ${cleanUserId}, trying fallback (limit 5000)...`);
            const { data: allReading, error: readingErr } = await supabase
                .from('bible_reading_logs')
                .select('*') // No join
                .order('created_at', { ascending: false })
                .limit(5000);

            if (readingErr) console.error('Fallback query error:', readingErr);

            if (allReading) {
                bibleReadings = allReading.filter(b => b.user_id && b.user_id.trim() === cleanUserId).slice(0, 1000);
                console.log(`Fallback found ${bibleReadings.length} bible readings`);
            }
        }

        // 3. Post-process to add book names (since join might fail if SQL hasn't been run perfect)
        if (bibleReadings.length > 0) {
            const { data: bookNames } = await supabase.from('books').select('id, name_full');
            if (bookNames) {
                const bookMap = {};
                bookNames.forEach(b => bookMap[b.id] = b.name_full);
                bibleReadings = bibleReadings.map(r => ({
                    ...r,
                    books: { name_full: bookMap[r.book_id] || `Book ${r.book_id}` }
                }));
            }
        }

        return {
            success: true,
            searches,
            aiQuestions,
            blogViews,
            bibleReadings,
            activities,
            sermonCount
        };
    } catch (error) {
        console.error('Error getting user history:', error);
        return { success: false, searches: [], aiQuestions: [], blogViews: [], bibleReadings: [], activities: [] };
    }
};
/**
 * Get the original language (Greek or Hebrew) text for a specific verse
 */
export const getOriginalVerse = async (bookId, chapter, verse) => {
    try {
        // 1. Get book testament
        const { data: book } = await supabase
            .from('books')
            .select('testament')
            .eq('id', bookId)
            .single();

        if (!book) throw new Error('Book not found');

        const versionId = book.testament === 'NT' ? 'SBLGNT' : 'WLC';

        const { data, error } = await supabase
            .from('verses')
            .select('text')
            .eq('book_id', bookId)
            .eq('chapter', chapter)
            .eq('verse', verse)
            .eq('version', versionId)
            .single();

        if (error) throw error;
        return { success: true, text: data?.text, version: versionId };
    } catch (error) {
        console.error('Error fetching original verse:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get a specific verse by ID components
 */
export const getVerse = async (bookId, chapter, verse, versionId = 'KJV') => {
    try {
        const { data, error } = await supabase
            .from('verses')
            .select(`
                id,
                book_id,
                chapter,
                verse,
                text,
                version,
                red_letters,
                books (
                    id,
                    name_full,
                    testament
                )
            `)
            .eq('book_id', bookId)
            .eq('chapter', chapter)
            .eq('verse', verse)
            .eq('version', versionId)
            .single();

        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        console.error('Error fetching verse:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Find a verse by a reference string like "John 3:16" or "1 John 1:1"
 */
export const getVerseByReference = async (refString, versionId = 'KJV') => {
    try {
        // Simple parser for "Book Chapter:Verse"
        const match = refString.match(/(.+?)\s+(\d+)[:\s]+(\d+)/);
        if (!match) throw new Error('Invalid reference format');

        const [_, bookName, chapter, verse] = match;
        let bookId;

        // 1. If bookName is a number, it's likely a direct ID
        if (/^\d+$/.test(bookName.trim())) {
            bookId = parseInt(bookName.trim());
        } else {
            // Find book ID by name
            let targetBookName = bookName.trim();

            // Check if name is Afrikaans and map to English for DB lookup
            const englishName = Object.keys(AFRIKAANS_BOOK_NAMES).find(key =>
                AFRIKAANS_BOOK_NAMES[key].toLowerCase() === targetBookName.toLowerCase()
            );
            if (englishName) {
                targetBookName = englishName;
            }

            const { data: books, error: bookError } = await supabase
                .from('books')
                .select('id')
                .ilike('name_full', `%${targetBookName}%`)
                .limit(1);

            if (bookError || !books || books.length === 0) throw new Error('Book not found');
            bookId = books[0].id;
        }

        // 2. Get the verse
        return await getVerse(bookId, parseInt(chapter), parseInt(verse), versionId);
    } catch (error) {
        console.error('Error fetching verse by reference:', error);
        return { success: false, error: error.message };
    }
};
// Keep track of last log to prevent duplicates (e.g. from React strict mode or rapid navigations)
let lastReadingLog = {
    bookId: null,
    chapter: null,
    timestamp: 0
};

/**
 * Log a Bible reading entry and sync "Last Read" state to cloud
 */
export const logBibleReading = async (bookId, chapter) => {
    try {
        // Prevent duplicate logs within 60 seconds for the same chapter
        const now = Date.now();
        if (
            lastReadingLog.bookId === bookId &&
            lastReadingLog.chapter === chapter &&
            now - lastReadingLog.timestamp < 60000 // 60 seconds
        ) {
            console.log(`Skipping duplicate reading log for ${bookId} ${chapter}`);
            return;
        }

        const userId = await getUserId();

        // 1. Log to historical table
        supabase.from('bible_reading_logs').insert({
            user_id: userId,
            book_id: bookId,
            chapter: chapter,
            device_info: navigator.userAgent,
            ip_address: getCapturedIp()
        }).then(({ error }) => {
            if (error) console.warn('❌ Error logging Bible reading:', error);
        });

        // 2. Sync to "Last Read" state in user_profiles
        // We do this in background to avoid blocking
        updateLastReadState(userId, {
            bookId,
            chapter,
            updated_at: new Date().toISOString()
        });

        // Update last log cache
        lastReadingLog = {
            bookId,
            chapter,
            timestamp: now
        };

        console.log(`📖 Bible reading synced: Book ${bookId}, Ch ${chapter}`);
    } catch (err) {
        console.warn('Could not log Bible reading:', err);
    }
};

/**
 * Update the user's last read state in the cloud
 */
export const updateLastReadState = async (userId, state) => {
    try {
        if (!userId) userId = await getUserId();

        // Skip cloud sync for guest users - they use localStorage only
        if (userId.startsWith('user_')) {
            console.log('[Sync] Skipping cloud sync for guest user');
            return;
        }

        const { error } = await supabase
            .from('user_profiles')
            .update({
                last_read_state: state,
                last_seen: new Date().toISOString()
            })
            .eq('user_id', userId);

        if (error) throw error;
    } catch (err) {
        console.warn('[Sync] Failed to update last read state:', err.message);
    }
};

/**
 * Fetch the user's last read state from the cloud
 */
export const getLastReadState = async (userId) => {
    try {
        if (!userId) userId = await getUserId();

        // Skip cloud sync for guest users
        if (userId.startsWith('user_')) return { success: true, state: null };

        const { data, error } = await supabase
            .from('user_profiles')
            .select('last_read_state')
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        return { success: true, state: data?.last_read_state };
    } catch (err) {
        console.warn('[Sync] Failed to fetch last read state:', err.message);
        return { success: false, error: err.message };
    }
};

/**
 * Get global sermon statistics (count per user)
 */
export const getGlobalSermonStats = async () => {
    try {
        // 1. Try RPC First (Secure Global Stats)
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_global_sermon_counts_v5');

        if (rpcError) {
            if (rpcError.status !== 404) console.warn('Sermon Stats RPC Missing:', rpcError);
        }

        if (!rpcError && rpcData) {
            return rpcData.map(d => ({
                userId: d.user_id,
                count: d.count
            }));
        }

        // 2. Fallback: RLS-limited Select (Legacy)
        const { data, error } = await supabase
            .from('sermons')
            .select('user_id');

        if (error) throw error;

        const stats = {};
        if (data) {
            data.forEach(s => {
                const uid = s.user_id || 'unknown';
                stats[uid] = (stats[uid] || 0) + 1;
            });
        }

        // Convert to array
        return Object.keys(stats).map(userId => ({
            userId,
            count: stats[userId]
        })).sort((a, b) => b.count - a.count);

    } catch (error) {
        console.error('Error getting global sermon stats:', error);
        return [];
    }
};
