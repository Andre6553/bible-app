import { useState, useEffect, useRef } from 'react';
import { logError } from '../services/loggerService';

import { supabase, supabaseUrl, supabaseKey } from '../config/supabaseClient';
import { getUserStatistics, getUserHistory } from '../services/bibleService';
import {
    isRateLimitEnabled,
    toggleRateLimit as toggleRateLimitSetting,
    isSuperUser,
    addSuperUser,
    removeSuperUser,
    isSuperUserAutoEnabled,
    toggleSuperUserAuto,
    getSuperUsers
} from '../services/blogService';
import {
    getEmailNotificationSettings,
    toggleEmailNotification,
    getEmailTemplates,
    updateEmailTemplate
} from '../services/adminService';
import { checkForNewJoinsAndNotify, notifyAdminOfNewUser, sendWelcomeEmail } from '../services/emailService';
import './Stats.css';
import './StatsChart.css';

const DEFAULT_WELCOME = `Dear New Member,

Welcome to Omni Bible! We are thrilled to have you join our community. Omni Bible is designed to be more than just a reader; it's a comprehensive tool to help you dive deeper into God's Word every day.

Here are some of the powerful features you can now explore:
• Read across 8+ versions (including AFR53, AFR83, KJV, NLT, and more).
• Parallel Reading: Compare versions side-by-side for deeper understanding.
• Personal Studies: Create Inductive Bible Studies and Word Studies with AI assistance.
• Highlights & Notes: Color-code your favorite verses and keep personal journals.
• Daily Inspiration: Get fresh, AI-generated devotionals tailored to your interests.
• Fully Responsive: Access your studies seamlessly on both PC and mobile.

We hope Omni Bible becomes a valuable companion in your walk of faith. If you have any questions or feedback, feel free to reach out.

Blessings,
The Omni Bible Team`.trim();

const DEFAULT_ADMIN = `Hello Andre,

A new user has just joined Omni Bible!

Details:
• User ID: {{userId}}
• Email: {{userEmail}}
• Time: {{time}}

You can view more details and user analytics on the Stats Dashboard.

Best regards,
Omni Bible System`.trim();

function Stats() {
    const [logs, setLogs] = useState([]);
    const [aiQuestions, setAiQuestions] = useState([]);
    const [readingLogs, setReadingLogs] = useState([]); // New reading logs
    const [errorLogs, setErrorLogs] = useState([]); // New Error Logs
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // User Stats
    const [userStats, setUserStats] = useState({ totalUsers: 0, topUsers: [] });
    const [selectedUser, setSelectedUser] = useState(null);
    const [selectedUserHistory, setSelectedUserHistory] = useState({ searches: [], aiQuestions: [], blogViews: [], bibleReadings: [], activities: [] });
    const [historyLoading, setHistoryLoading] = useState(false);

    const [stats, setStats] = useState({ total: 0, topTerms: [] });

    // AI Stats State
    const [aiStats, setAiStats] = useState({ total: 0, topQuestions: [] });
    // Modal for detail view
    const [selectedItem, setSelectedItem] = useState(null);
    const [itemType, setItemType] = useState(null); // 'search', 'ai', or 'error'
    // Date range delete
    const [showDateRangeModal, setShowDateRangeModal] = useState(false);
    const [dateRangeType, setDateRangeType] = useState(null); // 'search' or 'ai'
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    // Authentication
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [pinInput, setPinInput] = useState('');
    const [authError, setAuthError] = useState(false);

    // Admin Settings
    const [rateLimitEnabled, setRateLimitEnabled] = useState(false);
    const [rateLimitLoading, setRateLimitLoading] = useState(false);
    const [superAutoEnabled, setSuperAutoEnabled] = useState(false);
    const [superAutoLoading, setSuperAutoLoading] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isUserSuper, setIsUserSuper] = useState(false);
    const [allSuperUsers, setAllSuperUsers] = useState([]);
    const [showClearErrorConfirm, setShowClearErrorConfirm] = useState(false);

    // Email Notification Settings
    const [emailAdminNotify, setEmailAdminNotify] = useState(false);
    const [emailUserWelcome, setEmailUserWelcome] = useState(false);
    const [emailSettingsLoading, setEmailSettingsLoading] = useState(false);
    const [emailTestLoading, setEmailTestLoading] = useState(false);
    const [emailTestFeedback, setEmailTestFeedback] = useState('');
    const [emailTemplates, setEmailTemplates] = useState({ welcome: '', admin: '' });
    const [emailTemplatesLoading, setEmailTemplatesLoading] = useState(false);
    const [emailTemplatesSaving, setEmailTemplatesSaving] = useState(false);
    const [showTemplateEditor, setShowTemplateEditor] = useState(false);

    useEffect(() => {
        // Only fetch if authenticated
        if (isAuthenticated) {
            fetchLogs();
            fetchAIQuestions();
            fetchReadingLogs();
            fetchUserStats();
            fetchRateLimitSetting();
            fetchSuperAutoSetting();
            fetchErrorLogs();
            fetchEmailSettings();
            fetchEmailTemplates();
        }
    }, [isAuthenticated]);

    const fetchRateLimitSetting = async () => {
        const enabled = await isRateLimitEnabled();
        setRateLimitEnabled(enabled);
    };

    const fetchSuperAutoSetting = async () => {
        const enabled = await isSuperUserAutoEnabled();
        setSuperAutoEnabled(enabled);
    };

    const handleToggleRateLimit = async () => {
        setRateLimitLoading(true);
        const newValue = !rateLimitEnabled;
        console.log('🔘 Rate Limit Toggle Clicked. New Value:', newValue ? 'ON' : 'OFF');
        const result = await toggleRateLimitSetting(newValue);
        if (result.success) {
            setRateLimitEnabled(newValue);
        } else {
            alert('Failed to update setting: ' + result.error);
        }
        setRateLimitLoading(false);
    };

    const handleToggleSuperAuto = async () => {
        const newValue = !superAutoEnabled;
        console.log('🔘 Super User Auto Toggle Clicked. New Value:', newValue ? 'ON' : 'OFF');
        setSuperAutoLoading(true);
        const result = await toggleSuperUserAuto(newValue);
        if (result.success) {
            setSuperAutoEnabled(newValue);
        } else {
            alert('Failed to update setting: ' + result.error);
        }
        setSuperAutoLoading(false);
    };

    const fetchEmailSettings = async () => {
        const result = await getEmailNotificationSettings();
        if (result.success) {
            setEmailAdminNotify(result.data.adminNotify);
            setEmailUserWelcome(result.data.userWelcome);
        }
    };

    const handleToggleEmailAdmin = async () => {
        setEmailSettingsLoading(true);
        const nextValue = !emailAdminNotify;
        const result = await toggleEmailNotification('admin_new_user_email_enabled', nextValue);
        if (result.success) setEmailAdminNotify(nextValue);
        setEmailSettingsLoading(false);
    };

    const handleToggleEmailWelcome = async () => {
        setEmailSettingsLoading(true);
        const nextValue = !emailUserWelcome;
        const result = await toggleEmailNotification('user_welcome_email_enabled', nextValue);
        if (result.success) setEmailUserWelcome(nextValue);
        setEmailSettingsLoading(false);
    };

    const fetchEmailTemplates = async () => {
        setEmailTemplatesLoading(true);
        const result = await getEmailTemplates();
        if (result.success) {
            // Pre-populate with defaults if DB is empty
            const templates = {
                welcome: result.data.welcome || DEFAULT_WELCOME,
                admin: result.data.admin || DEFAULT_ADMIN
            };
            setEmailTemplates(templates);
        }
        setEmailTemplatesLoading(false);
    };

    const handleResetTemplate = (key) => {
        if (window.confirm(`Reset the ${key} template to the professional default?`)) {
            setEmailTemplates(prev => ({
                ...prev,
                [key]: key === 'welcome' ? DEFAULT_WELCOME : DEFAULT_ADMIN
            }));
        }
    };

    const handleUpdateTemplate = async (key, value) => {
        setEmailTemplatesSaving(true);
        const dbKey = key === 'welcome' ? 'email_template_welcome_body' : 'email_template_admin_body';
        const result = await updateEmailTemplate(dbKey, value);
        if (result.success) {
            setEmailTemplates(prev => ({ ...prev, [key]: value }));
            setEmailTestFeedback(`✅ ${key === 'welcome' ? 'Welcome' : 'Admin'} template saved!`);
            setTimeout(() => setEmailTestFeedback(''), 3000);
        } else {
            alert('Failed to save template: ' + result.error);
        }
        setEmailTemplatesSaving(false);
    };

    const handleSendTestEmail = async (type) => {
        setEmailTestLoading(true);
        setEmailTestFeedback('');
        try {
            // Simulated delay for feedback
            await new Promise(r => setTimeout(r, 800));

            if (type === 'admin') {
                // Pass true to bypass toggle check for test
                await notifyAdminOfNewUser('TEST_ID', 'andre.ecprint@gmail.com', true);
                setEmailTestFeedback('✅ Admin Alert sent to console!');
            } else {
                // Pass true to bypass toggle check for test
                await sendWelcomeEmail('andre.ecprint@gmail.com', true);
                setEmailTestFeedback('✅ Welcome Email sent to console!');
            }

            // Clear feedback after 3s
            setTimeout(() => setEmailTestFeedback(''), 3000);
        } catch (err) {
            setEmailTestFeedback('❌ Test failed (check console)');
        } finally {
            setEmailTestLoading(false);
        }
    };

    const fetchReadingLogs = async () => {
        try {
            const { data, error } = await supabase
                .from('bible_reading_logs')
                .select('*, books(name_full)')
                .order('created_at', { ascending: false })
                .limit(50);

            if (data) setReadingLogs(data);
            if (error) {
                // If it's a known schema error (missing relationship or table), fallback silently
                if (error.code === 'PGRST200' || error.status === 404) {
                    const { data: raw } = await supabase.from('bible_reading_logs').select('*').order('created_at', { ascending: false }).limit(50);
                    if (raw) setReadingLogs(raw);
                } else {
                    console.warn('Reading logs fetch error:', error);
                }
            }
        } catch (e) {
            console.warn('Error fetching reading logs:', e);
        }
    };

    const handleLogin = (e) => {
        e.preventDefault();
        if (pinInput === '58078') {
            setIsAuthenticated(true);
            setAuthError(false);
        } else {
            setAuthError(true);
            setPinInput('');
        }
    };

    const fetchUserStats = async () => {
        const result = await getUserStatistics();
        if (result.success) {
            setUserStats(result.data);
        }
        // Also fetch super users list for badges
        const superList = await getSuperUsers();
        setAllSuperUsers(superList);
    };

    const fetchLogs = async () => {
        setLoading(true);
        // Fetch last 5000 logs to match stats calculation window
        const { data, error } = await supabase
            .from('search_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5000);

        if (error) {
            console.error("Error fetching available logs:", error);
            setError("Could not load stats. You might need to enable 'Select' permissions in Supabase.");
            setLoading(false);
            return;
        }

        processStats(data);
        setLogs(data);
        setLoading(false);
    };

    const fetchAIQuestions = async () => {
        const { data, error } = await supabase
            .from('ai_questions')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5000);

        if (error) {
            console.error("Error fetching AI questions:", error);
            return;
        }

        processAIStats(data);
        setAiQuestions(data);
    };

    const fetchErrorLogs = async () => {
        const { data, error } = await supabase
            .from('app_errors')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1000);

        if (error) {
            console.error("Error fetching app errors:", error);
            return;
        }
        setErrorLogs(data);
    };

    const handleUserClick = async (user) => {
        setIsUserSuper(false);
        setSelectedUser(user);
        setHistoryLoading(true);
        setShowDeleteConfirm(false);

        try {
            // 1. Check super user status (Check ALL linked IDs)
            const idsToCheck = user.originalIds && user.originalIds.length > 0 ? user.originalIds : [user.userId];
            let superStatus = false;
            // If ANY of the linked IDs are super, we consider the user super
            for (const id of idsToCheck) {
                if (await isSuperUser(id)) {
                    superStatus = true;
                    break;
                }
            }
            setIsUserSuper(superStatus);

            // 2. Initial Local Fetch (from already loaded logs if available)
            const targetId = String(user.userId).trim();
            const localSearches = logs.filter(l => String(l.user_id).trim() === targetId).slice(0, 20);
            const localAi = aiQuestions.filter(q => String(q.user_id).trim() === targetId).slice(0, 20);

            setSelectedUserHistory({
                searches: localSearches,
                aiQuestions: localAi,
                blogViews: [],
                bibleReadings: [],
                activities: []
            });

            // 3. Complete Server Fetch
            const history = await getUserHistory(user.userId);
            if (history.success) {
                setSelectedUserHistory({
                    searches: history.searches || [],
                    aiQuestions: history.aiQuestions || [],
                    blogViews: history.blogViews || [],
                    bibleReadings: history.bibleReadings || [],
                    activities: history.activities || []
                });
            }
        } catch (err) {
            console.error("Error in handleUserClick:", err);
        } finally {
            setHistoryLoading(false);
        }
    };

    // Auto-refresh chart data every 5 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            fetchUserStats();
        }, 5000); // 5000ms = 5 seconds

        // Cleanup interval on component unmount
        return () => clearInterval(interval);
    }, []);

    // Also check for new joins when userStats changes (passive admin notification)
    useEffect(() => {
        if (userStats.totalUsers > 0 && isAuthenticated) {
            checkForNewJoinsAndNotify(userStats.totalUsers);
        }
    }, [userStats.totalUsers, isAuthenticated]);

    const handleRefreshData = async () => {
        if (!selectedUser) return;
        setHistoryLoading(true);

        try {
            // 1. Refresh global stats (Top users, counts, etc)
            const result = await getUserStatistics();
            if (result.success) {
                setUserStats(result.data);

                // Update selectedUser with latest count from fresh data
                const updatedUser = result.data.topUsers.find(u => u.userId === selectedUser.userId);
                if (updatedUser) {
                    setSelectedUser(prev => ({
                        ...prev,
                        count: updatedUser.count,
                        device: updatedUser.device
                    }));
                }
            }

            // 2. Refresh raw logs (for the local filters)
            await Promise.all([fetchLogs(), fetchAIQuestions()]);

            // 3. Refresh specific user history
            const history = await getUserHistory(selectedUser.userId);
            if (history.success) {
                setSelectedUserHistory({
                    searches: history.searches || [],
                    aiQuestions: history.aiQuestions || [],
                    blogViews: history.blogViews || [],
                    bibleReadings: history.bibleReadings || [],
                    activities: history.activities || []
                });
            }
        } catch (err) {
            console.error("Refresh error:", err);
        } finally {
            setHistoryLoading(false);
        }
    };

    const processAIStats = (data) => {
        const total = data.length;

        // Count frequencies
        const counts = {};
        data.forEach(item => {
            // Normalize: lowercase, trim, first 100 chars
            const q = item.question.toLowerCase().trim().substring(0, 100);
            counts[q] = (counts[q] || 0) + 1;
        });

        // Sort by frequency
        const sorted = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([question, count]) => ({ question, count }));

        setAiStats({ total, topQuestions: sorted });
    };

    const processStats = (data) => {
        const total = data.length;

        // Count frequencies
        const counts = {};
        data.forEach(item => {
            // Normalize: lowercase, trim
            const term = item.query.toLowerCase().trim();
            counts[term] = (counts[term] || 0) + 1;
        });

        // Sort by frequency
        const sorted = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10) // Top 10
            .map(([term, count]) => ({ term, count }));

        setStats({ total, topTerms: sorted });
    };

    // Delete all search logs
    const clearAllSearchLogs = async () => {
        if (!window.confirm('⚠️ Are you sure you want to DELETE ALL search logs? This cannot be undone!')) {
            return;
        }

        const { error } = await supabase
            .from('search_logs')
            .delete()
            .neq('id', 0); // Delete all (neq id 0 means all rows)

        if (error) {
            alert('Error deleting logs: ' + error.message);
        } else {
            // Clear local state immediately
            setLogs([]);
            setStats({ total: 0, topTerms: [] });
            alert('✅ All search logs deleted!');
        }
    };

    // Delete all AI logs
    const clearAllAILogs = async () => {
        if (!window.confirm('⚠️ Are you sure you want to DELETE ALL AI question logs? This cannot be undone!')) {
            return;
        }

        const { error } = await supabase
            .from('ai_questions')
            .delete()
            .neq('id', 0);

        if (error) {
            alert('Error deleting AI logs: ' + error.message);
        } else {
            setAiQuestions([]);
            setAiStats({ total: 0, topQuestions: [] });
            alert('✅ All AI question logs deleted!');
        }
    };

    // Delete all Error logs
    const clickClearErrors = () => {
        setShowClearErrorConfirm(true);
    };

    const confirmClearErrors = async () => {
        console.log('[Stats] 🗑️ Initiating Clear All (Custom UI Confirmed)...');
        setShowClearErrorConfirm(false);

        console.log('[Stats] 🚀 Sending delete request...');
        // Match all rows
        const { error } = await supabase
            .from('app_errors')
            .delete()
            .neq('error_message', '_impossible_string_');

        if (error) {
            console.error('[Stats] ❌ Clear failed:', error);
            alert('Error: ' + error.message);
        } else {
            console.log('[Stats] ✅ Clear successful');
            setErrorLogs([]);
            alert('✅ All error logs cleared.');
        }
    };

    const sendTestError = async () => {
        console.log('[Stats] ⚡ Initiating Test Crash...');
        try {
            const result = await logError(new Error("Test Crash Button Pressed"), {
                metadata: { type: 'manual_test', user_action: 'clicked_test_button' }
            });
            console.log('[Stats] 🏁 logError returned:', result);

            if (result && result.success) {
                alert("⚡ Test error sent successfully!");
                setTimeout(fetchErrorLogs, 500);
            } else {
                alert("❌ Failed to send. Check Console.");
            }
        } catch (err) {
            console.error('[Stats] 💥 Exception in sendTestError:', err);
            alert("Failed to send test error: " + err.message);
        }
    };

    // Copy Error Logic
    const longPressTimer = useRef(null);

    const handleCopyError = async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            alert("📋 Error message copied to clipboard!");
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const handleContextMenu = (e, text) => {
        e.preventDefault();
        handleCopyError(text);
    };

    const handleTouchStart = (e, text) => {
        longPressTimer.current = setTimeout(() => {
            handleCopyError(text);
            if (navigator.vibrate) navigator.vibrate(50);
        }, 800); // 800ms long press
    };

    const handleTouchEnd = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    // Delete single entry
    const deleteSingleEntry = async () => {
        if (!selectedItem) return;

        let table = '';
        if (itemType === 'search') table = 'search_logs';
        else if (itemType === 'ai') table = 'ai_questions';
        else if (itemType === 'error') table = 'app_errors';

        const itemDesc = itemType === 'error' ? 'crash report' : (itemType === 'search' ? 'search log' : 'AI question');

        if (!window.confirm(`Are you sure you want to delete this ${itemDesc}?`)) {
            return;
        }

        const { error } = await supabase
            .from(table)
            .delete()
            .eq('id', selectedItem.id);

        if (error) {
            alert('Error deleting: ' + error.message);
        } else {
            // Immediately update local state for instant UI feedback
            if (itemType === 'search') {
                setLogs(prevLogs => prevLogs.filter(log => log.id !== selectedItem.id));
                processStats(logs.filter(log => log.id !== selectedItem.id));
            } else if (itemType === 'ai') {
                setAiQuestions(prevQ => prevQ.filter(q => q.id !== selectedItem.id));
                processAIStats(aiQuestions.filter(q => q.id !== selectedItem.id));
            } else if (itemType === 'error') {
                setErrorLogs(prev => prev.filter(e => e.id !== selectedItem.id));
            }
            setSelectedItem(null);
        }
    };

    // Toggle super user status for ALL linked IDs
    const toggleSuperUser = async (userIds, currentStatus) => {
        // Ensure array
        const targets = Array.isArray(userIds) ? [...userIds] : [userIds];

        // [NEW] Also include the email if available (for robust cross-device access)
        if (selectedUser?.email && !targets.includes(selectedUser.email)) {
            targets.push(selectedUser.email);
            console.log('📧 Including email in Super User toggle:', selectedUser.email);
        }

        if (currentStatus) {
            // Remove ALL from super users
            let allSuccess = true;
            for (const id of targets) {
                const result = await removeSuperUser(id);
                if (!result.success) allSuccess = false;
            }

            if (allSuccess) {
                setIsUserSuper(false);
                setAllSuperUsers(prev => prev.filter(id => !targets.includes(id)));
            }
        } else {
            // Add ALL to super users
            let allSuccess = true;
            for (const id of targets) {
                const result = await addSuperUser(id);
                if (!result.success) allSuccess = false;
            }

            if (allSuccess) {
                setIsUserSuper(true);
                setAllSuperUsers(prev => [...prev, ...targets]);
            }
        }
    };

    // Delete all data for a specific user
    const deleteUserData = async (userId, isFullDelete = false) => {
        if (!window.confirm(`Are you sure you want to delete ${isFullDelete ? 'FULLY' : 'HISTORY'} for this user?`)) return;

        const idsToDelete = selectedUser?.originalIds || [userId];

        // 1. Ensure user existence is preserved in user_profiles before wiping logs
        // This prevents the "Total Users" count from dropping when logs are cleared.
        if (!isFullDelete) {
            for (const id of idsToDelete) {
                await supabase.from('user_profiles').upsert({ user_id: id }).select();
            }
        }

        const deletePromises = [
            supabase.from('search_logs').delete().in('user_id', idsToDelete),
            supabase.from('ai_questions').delete().in('user_id', idsToDelete),
            supabase.from('blog_views').delete().in('user_id', idsToDelete),
            supabase.from('bible_reading_logs').delete().in('user_id', idsToDelete),
            supabase.from('user_activity_logs').delete().in('user_id', idsToDelete)
        ];

        if (isFullDelete) {
            // Delete from tables that use the primary user_id (and iterate if multiple)
            idsToDelete.forEach(id => {
                deletePromises.push(supabase.from('user_profiles').delete().eq('user_id', id));
                deletePromises.push(supabase.from('verse_highlights').delete().eq('user_id', id));
                deletePromises.push(supabase.from('verse_notes').delete().eq('user_id', id));
            });
        }

        const results = await Promise.all(deletePromises);
        const errors = results.filter(r => r.error);

        if (errors.length > 0) {
            alert('Error during deletion. See console.');
        } else {
            alert('✅ User data deleted.');
            fetchUserStats();
            setSelectedUser(null);
        }
    };

    const handleDeleteUserFully = (userId) => deleteUserData(userId, true);

    // Open date range modal
    const openDateRangeModal = (type) => {
        setDateRangeType(type);
        setStartDate('');
        setEndDate('');
        setShowDateRangeModal(true);
    };

    // Delete by date range
    const deleteByDateRange = async () => {
        if (!startDate || !endDate) return;
        const table = dateRangeType === 'search' ? 'search_logs' : 'ai_questions';
        const startDateTime = `${startDate}T00:00:00`;
        const endDateTime = `${endDate}T23:59:59`;

        const { error } = await supabase.from(table).delete().gte('created_at', startDateTime).lte('created_at', endDateTime);
        if (!error) {
            setShowDateRangeModal(false);
            dateRangeType === 'search' ? fetchLogs() : fetchAIQuestions();
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="stats-login-container">
                <div className="stats-login-card">
                    <h2>Admin Access 🔒</h2>
                    <form onSubmit={handleLogin}>
                        <input type="text" autoComplete="username" style={{ display: 'none' }} />
                        <input
                            type="password"
                            value={pinInput}
                            onChange={(e) => setPinInput(e.target.value)}
                            placeholder="Enter PIN"
                            className="pin-input"
                            autoFocus
                            autoComplete="current-password"
                        />
                        {authError && <p className="error-msg">Incorrect PIN</p>}
                        <button type="submit" className="login-btn">Unlock</button>
                    </form>
                </div>
            </div>
        );
    }

    if (loading) return <div className="stats-loading">Loading Analytics...</div>;

    return (
        <div className="stats-page">
            <div className="stats-header-row">
                <h1 className="stats-title">Search Analytics 📊</h1>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="logout-btn" style={{ background: '#4a90d9' }} onClick={() => window.location.href = '/admin'}>API Dashboard 📈</button>
                    <button className="logout-btn" onClick={() => setIsAuthenticated(false)}>Lock 🔒</button>
                </div>
            </div>

            {error && (
                <div className="stats-error">
                    <h3>⚠️ Permission Needed</h3>
                    <p>{error}</p>
                </div>
            )}

            {/* Global Activity Chart using CSS Grid/Flex */}
            {
                userStats.globalActivityCounts && (
                    <div className="full-width-card" style={{ marginTop: '20px', marginBottom: '20px' }}>
                        <div className="settings-card">
                            <h3>📊 Global Activity Distribution</h3>
                            <div className="activity-chart-container">
                                {Object.keys(userStats.globalActivityCounts || {})
                                    .filter(key => {
                                        // Ignore zero counts to keep chart clean
                                        return userStats.globalActivityCounts[key] > 0;
                                    })
                                    .map(key => {
                                        // Fallback for completely unknown keys
                                        const mappings = {
                                            'search': { label: 'Search', icon: '🔍', color: '#6366f1' },
                                            'ai': { label: 'AI Search', icon: '🤖', color: '#8b5cf6' },
                                            'bible': { label: 'Bible Read', icon: '📖', color: '#10b981' },
                                            'study_page_visit': { label: 'Visited Study Page', icon: '✍️', color: '#f59e0b' },
                                            'inductive_study': { label: 'Inductive Study', icon: '📝', color: '#f59e0b' },
                                            'inductive_study_saved': { label: 'Saved Inductive Study', icon: '💾', color: '#d97706' },
                                            'notes_visit': { label: 'Visited Notes', icon: '📒', color: '#ec4899' },
                                            'note_created': { label: 'Created Note', icon: '✨', color: '#d946ef' },
                                            'word_study_visit': { label: 'Visited Word Study', icon: '🅰️', color: '#06b6d4' },
                                            'verse_highlight': { label: 'Highlighted verse', icon: '🖊️', color: '#ef4444' },
                                            'blog_visit': { label: 'Visited "For You" Blog', icon: '📰', color: '#3b82f6' },
                                            'blog_post_open': { label: 'Opened Blog Post', icon: '👓', color: '#2563eb' },
                                            // New Granular AI Types
                                            'inductive_hint_1': { label: 'Inductive Hint Step 1', icon: '1️⃣', color: '#10b981' },
                                            'inductive_hint_2': { label: 'Inductive Hint Step 2', icon: '2️⃣', color: '#3b82f6' },
                                            'inductive_hint_3': { label: 'Inductive Hint Step 3', icon: '3️⃣', color: '#8b5cf6' },
                                            'word_study_ai': { label: 'Word Study', icon: '🅰️', color: '#06b6d4' },
                                            'semantic_search': { label: 'Semantic Search', icon: '🧠', color: '#f43f5e' },

                                            'uncategorized': { label: 'General Activity', icon: '⚡', color: '#94a3b8' },
                                            'unknown_action': { label: 'Unknown Action', icon: '❓', color: '#cbd5e1' }
                                        };

                                        // Fallback for completely unknown keys
                                        const config = mappings[key] || {
                                            label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                                            icon: '⚡',
                                            color: '#cbd5e1'
                                        };

                                        return { key, ...config, count: userStats.globalActivityCounts[key] };
                                    })
                                    .sort((a, b) => b.count - a.count) // Sort by count desc
                                    .map((item) => {
                                        const total = userStats.globalActivityCounts.total ||
                                            Object.values(userStats.globalActivityCounts).reduce((a, b) => a + b, 0);
                                        const percent = total > 0 ? (item.count / total) * 100 : 0;

                                        return (
                                            <div key={item.key} className="chart-item">
                                                <div className="chart-label">
                                                    <span className="chart-icon" style={{ backgroundColor: `${item.color}20`, color: item.color }}>
                                                        {item.icon}
                                                    </span>
                                                    <span className="label-text">{item.label}</span>
                                                </div>
                                                <div className="chart-bar-container">
                                                    <div
                                                        className="chart-bar-fill"
                                                        style={{
                                                            width: `${percent}%`,
                                                            backgroundColor: item.color
                                                        }}
                                                    />
                                                </div>
                                                <span className="chart-count">{item.count}</span>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    </div>
                )
            }

            <div className="stats-grid">
                <div className="stat-card summary-card">
                    <h3>Total Searches</h3>
                    <div className="big-number">{stats.total}</div>
                    <p className="subtitle">Last 5000 records</p>
                    <div className="card-actions">
                        <button className="clear-all-btn" onClick={clearAllSearchLogs}>🗑️ Clear All</button>
                        <button className="date-range-btn" onClick={() => openDateRangeModal('search')}>📅 Delete by Date</button>
                    </div>
                </div>

                <div className="stat-card">
                    <h3>🏆 Top Search Terms</h3>
                    {stats.topTerms.length === 0 ? (
                        <p className="no-data">No data yet</p>
                    ) : (
                        <ul className="top-list">
                            {stats.topTerms.map((item, idx) => (
                                <li key={idx} className="top-item">
                                    <span className="rank">#{idx + 1}</span>
                                    <span className="term">"{item.term}"</span>
                                    <span className="count">{item.count}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="stat-card recent-list">
                    <h3>🕒 Recent Activity</h3>
                    <div className="log-table-wrapper">
                        <table className="log-table desktop-only">
                            <thead>
                                <tr><th>Time</th><th>User</th><th>Query</th></tr>
                            </thead>
                            <tbody>
                                {logs.slice(0, 15).map((log) => (
                                    <tr key={log.id} className="clickable-row" onClick={() => { setSelectedItem(log); setItemType('search'); }}>
                                        <td>{new Date(log.created_at).toLocaleTimeString()}</td>
                                        <td>{log.user_id ? log.user_id.substring(0, 8) + '...' : 'Anon'}</td>
                                        <td>{log.query}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="mobile-cards mobile-only">
                            {logs.slice(0, 10).map((log) => (
                                <div key={log.id} className="log-card" onClick={() => { setSelectedItem(log); setItemType('search'); }}>
                                    <div className="log-card-header">
                                        <span>{new Date(log.created_at).toLocaleTimeString()}</span>
                                    </div>
                                    <div className="log-card-query">{log.query}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <h2 className="section-title">📖 Bible Reading Analytics</h2>
            <div className="stats-grid">
                <div className="stat-card recent-list full-width-card">
                    <h3>🕒 Recent Bible Activity</h3>
                    <div className="log-table-wrapper">
                        <table className="log-table desktop-only">
                            <thead>
                                <tr><th>Time</th><th>User</th><th>Book/Ch</th></tr>
                            </thead>
                            <tbody>
                                {readingLogs.slice(0, 15).map((log) => (
                                    <tr key={log.id} className="clickable-row">
                                        <td>{new Date(log.created_at).toLocaleTimeString()}</td>
                                        <td>{log.user_id?.substring(0, 8)}...</td>
                                        <td>{log.books?.name_full || `Book ${log.book_id}`} {log.chapter}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="mobile-cards mobile-only">
                            {readingLogs.slice(0, 10).map((log) => (
                                <div key={log.id} className="log-card">
                                    <div className="log-card-header">
                                        <span>{new Date(log.created_at).toLocaleTimeString()}</span>
                                    </div>
                                    <div className="log-card-query">{log.books?.name_full || `Book ${log.book_id}`} Ch {log.chapter}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <h2 className="section-title">👥 User Activity</h2>
            <div className="stats-grid">
                <div className="stat-card summary-card user-summary">
                    <h3>Total Users</h3>
                    <div className="big-number">{userStats.totalUsers}</div>
                    <p className="subtitle">Unique devices</p>
                </div>

                <div className="stat-card">
                    <h3>🏆 Most Active Users</h3>
                    <div className="scrollable-user-list">
                        <ul className="top-list">
                            {userStats.topUsers.map((u, idx) => {
                                // Check if user is super (check all IDs + email)
                                const isSuper = (u.originalIds || [u.userId]).some(id => allSuperUsers.includes(id)) ||
                                    (u.email && allSuperUsers.includes(u.email));

                                return (
                                    <li key={idx} className="top-item clickable-row" onClick={() => handleUserClick(u)}>
                                        <span className="rank">#{idx + 1}</span>
                                        <div className="user-info-col">
                                            <span className="term">{u.displayId.substring(0, 15)}...</span>
                                            <span className="device-badge">
                                                {u.device}
                                                {isSuper && <span title="Super User" style={{ marginLeft: '4px' }}>⭐</span>}
                                            </span>
                                        </div>
                                        <span className="count">{u.count > 0 ? `${u.count} actions` : 'No recent activity'}</span>
                                    </li>
                                )
                            })}
                        </ul>
                    </div>
                </div>
            </div>

            <h2 className="section-title">🤖 AI Research Analytics</h2>
            <div className="stats-grid">
                <div className="stat-card summary-card ai-summary">
                    <h3>Total AI Questions</h3>
                    <div className="big-number">{aiStats.total}</div>
                    <p className="subtitle">Last 5000 records</p>
                    <div className="card-actions">
                        <button className="clear-all-btn clear-all-ai" onClick={clearAllAILogs}>🗑️ Clear All</button>
                        <button className="date-range-btn date-range-ai" onClick={() => openDateRangeModal('ai')}>📅 Delete by Date</button>
                    </div>
                </div>

                <div className="stat-card recent-list">
                    <h3>💬 Recent Questions</h3>
                    <div className="log-table-wrapper">
                        <table className="log-table desktop-only">
                            <thead>
                                <tr><th>Time</th><th>User</th><th>Question</th></tr>
                            </thead>
                            <tbody>
                                {aiQuestions.slice(0, 15).map((q) => (
                                    <tr key={q.id} className="clickable-row" onClick={() => { setSelectedItem(q); setItemType('ai'); }}>
                                        <td>{new Date(q.created_at).toLocaleTimeString()}</td>
                                        <td>{q.user_id?.substring(0, 8)}...</td>
                                        <td>{q.question.substring(0, 50)}...</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <h2 className="section-title">⚙️ Admin Settings</h2>
            <div className="stats-grid">
                <div className="stat-card settings-card">
                    <h3>Settings</h3>
                    <div className="setting-row">
                        <p>Blog Rate Limit: <strong>{rateLimitEnabled ? 'ON' : 'OFF'}</strong></p>
                        <label className="switch">
                            <input type="checkbox" checked={rateLimitEnabled} onChange={handleToggleRateLimit} />
                            <span className="slider"></span>
                        </label>
                    </div>
                    <div className="setting-row">
                        <p>Auto SuperUser: <strong>{superAutoEnabled ? 'ON' : 'OFF'}</strong></p>
                        <label className="switch">
                            <input type="checkbox" checked={superAutoEnabled} onChange={handleToggleSuperAuto} />
                            <span className="slider"></span>
                        </label>
                    </div>

                    <div className="setting-divider" style={{ margin: '15px 0', borderTop: '1px solid var(--border-subtle)', opacity: 0.3 }}></div>

                    <h3>📧 Email Notifications</h3>
                    <div className="setting-row">
                        <p>Notify Admin on new Join: <strong>{emailAdminNotify ? 'ON' : 'OFF'}</strong></p>
                        <label className="switch">
                            <input type="checkbox" checked={emailAdminNotify} onChange={handleToggleEmailAdmin} disabled={emailSettingsLoading} />
                            <span className="slider"></span>
                        </label>
                    </div>
                    <div className="setting-row">
                        <p>Send Welcome Email to Users: <strong>{emailUserWelcome ? 'ON' : 'OFF'}</strong></p>
                        <label className="switch">
                            <input type="checkbox" checked={emailUserWelcome} onChange={handleToggleEmailWelcome} disabled={emailSettingsLoading} />
                            <span className="slider"></span>
                        </label>
                    </div>

                    <div className="test-system-actions" style={{ marginTop: '20px', display: 'flex', gap: '10px', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                className="test-btn secondary-action-btn"
                                style={{ flex: 1, fontSize: '0.8rem', padding: '8px' }}
                                onClick={() => handleSendTestEmail('admin')}
                                disabled={emailTestLoading}
                            >
                                🧪 Test Admin Alert
                            </button>
                            <button
                                className="test-btn secondary-action-btn"
                                style={{ flex: 1, fontSize: '0.8rem', padding: '8px' }}
                                onClick={() => handleSendTestEmail('welcome')}
                                disabled={emailTestLoading}
                            >
                                🧪 Test Welcome Email
                            </button>
                        </div>
                        {emailTestFeedback && (
                            <p style={{ margin: '5px 0 0', fontSize: '0.8rem', color: emailTestFeedback.includes('✅') ? '#4ade80' : '#f87171', fontWeight: 'bold' }}>
                                {emailTestFeedback}
                            </p>
                        )}
                        <p style={{ margin: '5px 0 0', fontSize: '0.7rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                            * Tests bypass the toggle check and output to the browser console.
                        </p>
                    </div>

                    <div className="template-editor-section" style={{ marginTop: '25px', borderTop: '1px solid var(--border-subtle)', paddingTop: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h3 style={{ margin: 0 }}>📝 Edit Email Content</h3>
                            <button
                                className="secondary-action-btn"
                                style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                                onClick={() => setShowTemplateEditor(!showTemplateEditor)}
                            >
                                {showTemplateEditor ? '🔼 Hide Editor' : '🔽 Manage Templates'}
                            </button>
                        </div>

                        {showTemplateEditor && (
                            <div className="template-fields" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div className="template-field">
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                                        Welcome Email Body
                                    </label>
                                    <textarea
                                        style={{
                                            width: '100%',
                                            minHeight: '200px',
                                            padding: '12px',
                                            borderRadius: '8px',
                                            backgroundColor: 'rgba(255,255,255,0.05)',
                                            color: 'var(--text-primary)',
                                            border: '1px solid var(--border-subtle)',
                                            fontFamily: 'inherit',
                                            fontSize: '0.85rem',
                                            lineHeight: '1.5',
                                            resize: 'vertical'
                                        }}
                                        value={emailTemplates.welcome}
                                        onChange={(e) => setEmailTemplates(prev => ({ ...prev, welcome: e.target.value }))}
                                        placeholder="Enter the welcome message for new members..."
                                    />
                                    <button
                                        className="primary-action-btn"
                                        style={{ marginTop: '8px', width: 'auto', padding: '6px 15px', fontSize: '0.8rem' }}
                                        onClick={() => handleUpdateTemplate('welcome', emailTemplates.welcome)}
                                        disabled={emailTemplatesSaving}
                                    >
                                        {emailTemplatesSaving ? 'Saving...' : '💾 Save Welcome Template'}
                                    </button>
                                    <button
                                        className="secondary-action-btn"
                                        style={{ marginTop: '8px', marginLeft: '10px', width: 'auto', padding: '6px 15px', fontSize: '0.8rem', border: '1px dashed var(--border-subtle)' }}
                                        onClick={() => handleResetTemplate('welcome')}
                                    >
                                        🔄 Reset to Default
                                    </button>
                                </div>

                                <div className="template-field">
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                                        Admin Notification Body
                                    </label>
                                    <div style={{ marginBottom: '8px', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                                        Placeholders: <code>{`{{userId}}`}</code>, <code>{`{{userEmail}}`}</code>, <code>{`{{time}}`}</code>
                                    </div>
                                    <textarea
                                        style={{
                                            width: '100%',
                                            minHeight: '150px',
                                            padding: '12px',
                                            borderRadius: '8px',
                                            backgroundColor: 'rgba(255,255,255,0.05)',
                                            color: 'var(--text-primary)',
                                            border: '1px solid var(--border-subtle)',
                                            fontFamily: 'inherit',
                                            fontSize: '0.85rem',
                                            lineHeight: '1.5',
                                            resize: 'vertical'
                                        }}
                                        value={emailTemplates.admin}
                                        onChange={(e) => setEmailTemplates(prev => ({ ...prev, admin: e.target.value }))}
                                        placeholder="Enter the alert message for yourself..."
                                    />
                                    <button
                                        className="primary-action-btn"
                                        style={{ marginTop: '8px', width: 'auto', padding: '6px 15px', fontSize: '0.8rem' }}
                                        onClick={() => handleUpdateTemplate('admin', emailTemplates.admin)}
                                        disabled={emailTemplatesSaving}
                                    >
                                        {emailTemplatesSaving ? 'Saving...' : '💾 Save Admin Template'}
                                    </button>
                                    <button
                                        className="secondary-action-btn"
                                        style={{ marginTop: '8px', marginLeft: '10px', width: 'auto', padding: '6px 15px', fontSize: '0.8rem', border: '1px dashed var(--border-subtle)' }}
                                        onClick={() => handleResetTemplate('admin')}
                                    >
                                        🔄 Reset to Default
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <h2 className="section-title">🚨 System Health</h2>
            <div className="stats-grid">
                <div className="stat-card summary-card error-summary">
                    <h3>Total Crashes</h3>
                    <div className="big-number">{errorLogs.length}</div>
                    <button className="clear-all-btn" onClick={confirmClearErrors}>🗑️ Clear All</button>
                    <button className="date-range-btn" onClick={sendTestError}>⚡ Send Test</button>
                </div>

                <div className="stat-card recent-list full-width-card">
                    <h3>🛑 Crash Reports</h3>
                    <div className="log-table-wrapper">
                        <table className="log-table desktop-only">
                            <thead>
                                <tr><th>Time</th><th>Message</th><th>Device</th></tr>
                            </thead>
                            <tbody>
                                {errorLogs.slice(0, 10).map((err) => (
                                    <tr key={err.id} className="clickable-row error-row" onClick={() => { setSelectedItem(err); setItemType('error'); }}>
                                        <td>{new Date(err.created_at).toLocaleString()}</td>
                                        <td>{err.error_message.substring(0, 50)}...</td>
                                        <td>{err.device_info?.os || 'Unknown'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <h2 className="section-title">🔑 Project Credentials</h2>
            <div className="stats-grid">
                <div className="stat-card credentials-card full-width-card">
                    <p><strong>GitHub:</strong> Andre6553/bible-app</p>
                    <p><strong>Supabase:</strong> {supabaseUrl}</p>
                    <p><strong>Vercel:</strong> https://bible-app-phi-one.vercel.app</p>
                </div>
            </div>

            {/* Modals */}
            {
                selectedItem && (
                    <div className="detail-modal-overlay" onClick={() => setSelectedItem(null)}>
                        <div className="detail-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="detail-modal-header">
                                <h3>Details</h3>
                                <button onClick={() => setSelectedItem(null)}>✕</button>
                            </div>
                            <div className="detail-modal-body">
                                <pre>{JSON.stringify(selectedItem, null, 2)}</pre>
                            </div>
                            <div className="detail-modal-footer">
                                <button className="delete-entry-btn" onClick={deleteSingleEntry}>🗑️ Delete</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {
                showDateRangeModal && (
                    <div className="detail-modal-overlay" onClick={() => setShowDateRangeModal(false)}>
                        <div className="detail-modal" onClick={(e) => e.stopPropagation()}>
                            <h3>Delete by Date</h3>
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                            <button onClick={deleteByDateRange}>Confirm Delete</button>
                        </div>
                    </div>
                )
            }

            {
                selectedUser && (
                    <div className="detail-modal-overlay" onClick={() => setSelectedUser(null)}>
                        <div className="detail-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="detail-modal-header">
                                <h3>👤 User Analysis</h3>
                                <div className="header-actions">
                                    <button
                                        className={`refresh-modal-btn ${historyLoading ? 'spinning' : ''}`}
                                        onClick={handleRefreshData}
                                        title="Refresh Data"
                                    >
                                        🔄
                                    </button>
                                    <button onClick={() => setSelectedUser(null)}>✕</button>
                                </div>
                            </div>
                            <div className="detail-modal-body">
                                <p><strong>ID:</strong> {selectedUser.userId}</p>
                                <p><strong>Actions:</strong> {selectedUser.count}</p>
                                <p><strong>Blog Visits:</strong> {selectedUserHistory.blogViews.length > 0
                                    ? `${selectedUserHistory.blogViews.length} visits (Last: ${new Date(selectedUserHistory.blogViews[0].created_at).toLocaleDateString()})`
                                    : 'No visits recorded'}
                                </p>
                                <div className="super-user-toggle">
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={isUserSuper}
                                            onChange={() => toggleSuperUser(selectedUser.originalIds || [selectedUser.userId], isUserSuper)}
                                        />
                                        ⭐ Super User
                                    </label>
                                </div>
                                <div className="history-lists">
                                    <h5>Recent History</h5>
                                    {historyLoading ? <p>Loading...</p> : (
                                        <ul>
                                            {selectedUserHistory.searches
                                                .filter((s, i, self) => i === 0 || s.query !== self[i - 1].query || Math.abs(new Date(s.created_at) - new Date(self[i - 1].created_at)) > 60000)
                                                .map(s => <li key={s.id}>🔍 {s.query} <span className="history-time">({new Date(s.created_at).toLocaleString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })})</span></li>)}

                                            {selectedUserHistory.aiQuestions
                                                .filter((q, i, self) => i === 0 || q.question !== self[i - 1].question || Math.abs(new Date(q.created_at) - new Date(self[i - 1].created_at)) > 60000)
                                                .map(q => <li key={q.id}>🤖 {q.question.substring(0, 30)}... <span className="history-time">({new Date(q.created_at).toLocaleString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })})</span></li>)}

                                            {selectedUserHistory.bibleReadings
                                                .filter((r, i, self) => i === 0 || r.book_id !== self[i - 1].book_id || r.chapter !== self[i - 1].chapter || Math.abs(new Date(r.created_at) - new Date(self[i - 1].created_at)) > 60000)
                                                .map(r => <li key={r.id}>📖 Read {r.books?.name_full || `Book ${r.book_id}`} {r.chapter} <span className="history-time">({new Date(r.created_at).toLocaleString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })})</span></li>)}

                                            {selectedUserHistory.blogViews
                                                .filter((v, i, self) => i === 0 || v.post_id !== self[i - 1].post_id || Math.abs(new Date(v.created_at) - new Date(self[i - 1].created_at)) > 60000)
                                                .map(v => <li key={v.id}>📰 Visited Blog <span className="history-time">({new Date(v.created_at).toLocaleString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })})</span></li>)}

                                            {selectedUserHistory.activities
                                                .filter((a, i, self) => i === 0 || a.activity_type !== self[i - 1].activity_type || Math.abs(new Date(a.created_at) - new Date(self[i - 1].created_at)) > 60000)
                                                .map(a => {

                                                    const typeMap = {
                                                        'study_page_visit': 'Visited Study Page',
                                                        'inductive_study': 'Inductive Study',
                                                        'inductive_study_saved': 'Saved Inductive Study',
                                                        'notes_visit': 'Visited Notes',
                                                        'note_created': 'Created Note',
                                                        'word_study_visit': 'Visited Word Study',
                                                        'verse_highlight': 'Highlighted verse',
                                                        'blog_visit': 'Visited "For You" Blog',
                                                        'blog_post_open': 'Opened Blog Post',
                                                        'uncategorized': 'General Activity'
                                                    };
                                                    return <li key={a.id}>📰 {typeMap[a.activity_type] || a.activity_type} <span className="history-time">({new Date(a.created_at).toLocaleString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })})</span></li>;
                                                })}
                                        </ul>
                                    )}
                                </div>
                            </div>
                            <div className="detail-modal-footer">
                                <div className="modal-footer-actions">
                                    <button
                                        className="secondary-action-btn"
                                        onClick={() => deleteUserData(selectedUser.userId, false)}
                                    >
                                        🗑️ Clear History
                                    </button>
                                    <button
                                        className="danger-action-btn"
                                        onClick={() => handleDeleteUserFully(selectedUser.userId)}
                                    >
                                        💀 Nuke User
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}

export default Stats;
