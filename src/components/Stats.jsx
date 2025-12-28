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
import './Stats.css';

function Stats() {
    const [logs, setLogs] = useState([]);
    const [aiQuestions, setAiQuestions] = useState([]);
    const [errorLogs, setErrorLogs] = useState([]); // New Error Logs
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // User Stats
    const [userStats, setUserStats] = useState({ totalUsers: 0, topUsers: [] });
    const [selectedUser, setSelectedUser] = useState(null);
    const [selectedUserHistory, setSelectedUserHistory] = useState({ searches: [], aiQuestions: [] });
    const [historyLoading, setHistoryLoading] = useState(false);

    const [stats, setStats] = useState({ total: 0, topTerms: [] });

    // ... (rest of code) ...



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

    useEffect(() => {
        // Only fetch if authenticated
        if (isAuthenticated) {
            fetchLogs();
            fetchAIQuestions();
            fetchUserStats();
            fetchRateLimitSetting();
            fetchSuperAutoSetting();
            fetchErrorLogs();
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
        console.group('🔍 Debugging User Value');
        console.log('Selected User Object:', user);
        console.log('Total Local Logs Available:', logs.length);
        console.log('Total Local AI Questions Available:', aiQuestions.length);

        setSelectedUser(user);
        setShowDeleteConfirm(false);

        // Check if this user is a super user
        const superStatus = await isSuperUser(user.userId);
        setIsUserSuper(superStatus);

        // 1. Immediate Local Filter
        const targetId = String(user.userId).trim();
        console.log('Target User ID (Trimmed):', targetId);

        const localSearches = logs.filter(l => String(l.user_id).trim() === targetId).slice(0, 20);
        const localAi = aiQuestions.filter(q => String(q.user_id).trim() === targetId).slice(0, 20);

        console.log(`Local Filter Results:`, {
            foundSearches: localSearches.length,
            foundAiQuestions: localAi.length
        });

        if (localSearches.length === 0 && localAi.length === 0) {
            console.warn('⚠️ No local history found. Dumping first 3 logs to check ID format:', logs.slice(0, 3));
        }

        setSelectedUserHistory({
            searches: localSearches,
            aiQuestions: localAi
        });

        // 2. Fetch Deeper History (in background)
        setHistoryLoading(true);
        console.log('Fetching deeper history from server...');
        const history = await getUserHistory(user.userId);
        console.log('Server Fetch Result:', history);

        if (history.success) {
            const serverHasData = history.searches.length > 0 || history.aiQuestions.length > 0;
            const localIsEmpty = localSearches.length === 0 && localAi.length === 0;

            if (serverHasData || localIsEmpty) {
                console.log('Updating history with server data');
                setSelectedUserHistory({
                    searches: history.searches,
                    aiQuestions: history.aiQuestions
                });
            }
        }
        setHistoryLoading(false);
        console.groupEnd();
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
                // Also update the modal view if it's open
                setSelectedUserHistory(prev => ({
                    ...prev,
                    searches: prev.searches.filter(l => l.id !== selectedItem.id)
                }));
                processStats(logs.filter(log => log.id !== selectedItem.id));
            } else if (itemType === 'ai') {
                setAiQuestions(prevQ => prevQ.filter(q => q.id !== selectedItem.id));
                // Also update the modal view if it's open
                setSelectedUserHistory(prev => ({
                    ...prev,
                    aiQuestions: prev.aiQuestions.filter(q => q.id !== selectedItem.id)
                }));
                processAIStats(aiQuestions.filter(q => q.id !== selectedItem.id));
            } else if (itemType === 'error') {
                setErrorLogs(prev => prev.filter(e => e.id !== selectedItem.id));
            }
            setSelectedItem(null);
        }
    };

    // Toggle super user status
    const toggleSuperUser = async (userId, currentStatus) => {
        if (currentStatus) {
            // Remove from super users
            const result = await removeSuperUser(userId);
            if (result.success) {
                setIsUserSuper(false);
                setAllSuperUsers(prev => prev.filter(id => id !== userId));
            }
        } else {
            // Add to super users
            const result = await addSuperUser(userId);
            if (result.success) {
                setIsUserSuper(true);
                setAllSuperUsers(prev => [...prev, userId]);
            }
        }
    };

    // Delete all data for a specific user (called after UI confirmation)
    const deleteUserData = async (userId) => {
        // If the user has originalIds (from grouping), we need to delete all of them
        const idsToDelete = selectedUser?.originalIds || [userId];

        console.log('🗑️ Deleting user data for IDs:', idsToDelete);
        setShowDeleteConfirm(false);

        try {
            // Delete from search_logs
            console.log('Deleting from search_logs...');
            const { error: searchError } = await supabase
                .from('search_logs')
                .delete()
                .in('user_id', idsToDelete);

            if (searchError) {
                console.error('Error deleting search logs:', searchError);
            } else {
                console.log('✅ Search logs deleted');
            }

            // Delete from ai_questions
            console.log('Deleting from ai_questions...');
            const { error: aiError } = await supabase
                .from('ai_questions')
                .delete()
                .in('user_id', idsToDelete);

            if (aiError) {
                console.error('Error deleting AI questions:', aiError);
            } else {
                console.log('✅ AI questions deleted');
            }

            // Update local state lists by removing any item belonging to these IDs
            setLogs(prevLogs => prevLogs.filter(log => !idsToDelete.includes(log.user_id)));
            setAiQuestions(prevQ => prevQ.filter(q => !idsToDelete.includes(q.user_id)));

            // Refresh stats
            fetchLogs();
            fetchAIQuestions();
            fetchUserStats();

            // Close the modal
            setSelectedUser(null);

            const displayLabel = selectedUser?.email || userId.substring(0, 15) + '...';
            alert(`✅ All history for ${displayLabel} has been cleared.`);
        } catch (err) {
            alert('Error deleting user data: ' + err.message);
        }
    };

    // Fully delete user (Data + Highlights + Notes + Profile mapping)
    const handleDeleteUserFully = async (userId) => {
        const idsToDelete = selectedUser?.originalIds || [userId];
        console.log('💀 Fully deleting user and all associated IDs:', idsToDelete);

        if (!window.confirm("⚠️ This will PERMANENTLY delete all highlights, notes, and profile data for this user. Are you sure?")) {
            return;
        }

        try {
            // 1. Remove from super users list for all associated IDs
            for (const id of idsToDelete) {
                const superResult = await removeSuperUser(id);
                if (superResult.success) {
                    console.log(`✅ Removed ID ${id} from Super Users list`);
                }
            }
            setAllSuperUsers(prev => prev.filter(id => !idsToDelete.includes(id)));

            // 2. Clear all other data tables in parallel
            console.log('🧹 Purging personal data tables...');
            const purgePromises = [
                supabase.from('verse_highlights').delete().in('user_id', idsToDelete),
                supabase.from('highlight_categories').delete().in('user_id', idsToDelete),
                supabase.from('verse_notes').delete().in('user_id', idsToDelete),
                supabase.from('study_collections').delete().in('user_id', idsToDelete),
                supabase.from('user_labels').delete().in('user_id', idsToDelete)
            ];

            // 3. Delete profile mappings if they exist
            console.log(`🗑️ Removing profile mappings for IDs:`, idsToDelete);
            purgePromises.push(
                supabase.from('user_profiles').delete().in('user_id', idsToDelete)
            );

            const results = await Promise.all(purgePromises);
            const errors = results.filter(r => r.error);
            if (errors.length > 0) {
                console.warn('Some tables had errors during purge:', errors);
            }

            // 4. Delete activity logs (Search + AI) via existing logic
            await deleteUserData(userId);

            console.log('🏁 User full deletion sequence complete');
        } catch (err) {
            console.error('Error during full user deletion:', err);
            alert('Failed to fully delete user: ' + err.message);
        }
    };

    // Open date range modal
    const openDateRangeModal = (type) => {
        setDateRangeType(type);
        setStartDate('');
        setEndDate('');
        setShowDateRangeModal(true);
    };

    // Delete by date range
    const deleteByDateRange = async () => {
        if (!startDate || !endDate) {
            alert('Please select both start and end dates.');
            return;
        }

        const table = dateRangeType === 'search' ? 'search_logs' : 'ai_questions';
        const typeName = dateRangeType === 'search' ? 'search logs' : 'AI questions';

        // Add time to dates for proper range (start of day to end of day)
        const startDateTime = `${startDate}T00:00:00`;
        const endDateTime = `${endDate}T23:59:59`;

        if (!window.confirm(`⚠️ Delete all ${typeName} from ${startDate} to ${endDate}? This cannot be undone!`)) {
            return;
        }

        const { error, count } = await supabase
            .from(table)
            .delete()
            .gte('created_at', startDateTime)
            .lte('created_at', endDateTime);

        if (error) {
            alert('Error deleting: ' + error.message);
        } else {
            setShowDateRangeModal(false);
            alert(`✅ Deleted ${typeName} from ${startDate} to ${endDate}!`);
            // Refresh the data
            if (dateRangeType === 'search') {
                fetchLogs();
            } else {
                fetchAIQuestions();
            }
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="stats-login-container">
                <div className="stats-login-card">
                    <h2>Admin Access 🔒</h2>
                    <form onSubmit={handleLogin}>
                        {/* Hidden username field for accessibility/password managers */}
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
                    <p>Run this SQL in Supabase to fix:</p>
                    <code className="sql-snippet">
                        create policy "Enable select for all" on search_logs for select using (true);
                    </code>
                </div>
            )}

            <div className="stats-grid">
                {/* Summary Card */}
                <div className="stat-card summary-card">
                    <h3>Total Searches</h3>
                    <div className="big-number">{stats.total}</div>
                    <p className="subtitle">Last 1000 records</p>
                    <div className="card-actions">
                        <button className="clear-all-btn" onClick={clearAllSearchLogs}>
                            🗑️ Clear All
                        </button>
                        <button className="date-range-btn" onClick={() => openDateRangeModal('search')}>
                            📅 Delete by Date
                        </button>
                    </div>
                </div>

                {/* Top Terms Card */}
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

                {/* Recent Searches */}
                <div className="stat-card recent-list">
                    <h3>🕒 Recent Activity</h3>
                    <div className="log-table-wrapper">
                        {/* Desktop Table View */}
                        <table className="log-table desktop-only">
                            <thead>
                                <tr>
                                    <th>Time</th>
                                    <th>User</th>
                                    <th>Query</th>
                                    <th>Ver</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.slice(0, 20).map((log) => (
                                    <tr
                                        key={log.id}
                                        className="clickable-row"
                                        onClick={() => { setSelectedItem(log); setItemType('search'); }}
                                    >
                                        <td>{new Date(log.created_at).toLocaleTimeString()}</td>
                                        <td>
                                            <span
                                                className="user-badge clickable-user"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (log.user_id) {
                                                        handleUserClick({ userId: log.user_id, count: 1, device: 'Unknown' });
                                                    }
                                                }}
                                            >
                                                {log.user_id ? log.user_id.substring(0, 8) + '...' : 'Anon'}
                                            </span>
                                        </td>
                                        <td>{log.query}</td>
                                        <td>{log.version}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Mobile Card View */}
                        <div className="mobile-cards mobile-only">
                            {logs.slice(0, 20).map((log) => (
                                <div
                                    key={log.id}
                                    className="log-card clickable-row"
                                    onClick={() => { setSelectedItem(log); setItemType('search'); }}
                                >
                                    <div className="log-card-header">
                                        <span>{new Date(log.created_at).toLocaleTimeString()}</span>
                                        <span>{log.version}</span>
                                    </div>
                                    <div className="log-card-query">{log.query}</div>
                                    <div className="log-card-meta">
                                        <span
                                            className="user-badge clickable-user"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (log.user_id) {
                                                    handleUserClick({ userId: log.user_id, count: 1, device: 'Unknown' });
                                                }
                                            }}
                                        >
                                            👤 {log.user_id ? log.user_id.substring(0, 8) + '...' : 'Anon'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* User Activity Section */}
            <h2 className="section-title">👥 User Activity</h2>
            <div className="stats-grid">
                {/* Total Users Card */}
                <div className="stat-card summary-card user-summary">
                    <h3>Total Users</h3>
                    <div className="big-number">{userStats.totalUsers}</div>
                    <p className="subtitle">Unique devices/browsers</p>
                </div>

                {/* Top Active Users Card */}
                <div className="stat-card">
                    <h3>🏆 Most Active Users ({userStats.topUsers.length})</h3>
                    {userStats.topUsers.length === 0 ? (
                        <p className="no-data">No data yet</p>
                    ) : (
                        <div className="scrollable-user-list">
                            <ul className="top-list">
                                {userStats.topUsers.map((u, idx) => (
                                    <li key={idx} className="top-item clickable-row" onClick={() => handleUserClick(u)}>
                                        <span className="rank">#{idx + 1}</span>
                                        <div className="user-info-col">
                                            <span className="term user-id-term" title={u.displayId}>
                                                {u.displayId.includes('@') ? (
                                                    <span className="email-display">📧 {u.displayId}</span>
                                                ) : (
                                                    u.displayId.substring(0, 15) + (u.displayId.length > 15 ? '...' : '')
                                                )}
                                                {allSuperUsers.includes(u.userId) && <span className="list-super-badge" title="Super User"> ⭐</span>}
                                            </span>
                                            <span className="device-badge">{u.device}</span>
                                        </div>
                                        <span className="count">{u.count} actions</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>

            {/* AI Questions Section */}
            <h2 className="section-title">🤖 AI Research Analytics</h2>
            <div className="stats-grid">
                {/* AI Summary Card */}
                <div className="stat-card summary-card ai-summary">
                    <h3>Total AI Questions</h3>
                    <div className="big-number">{aiStats.total}</div>
                    <p className="subtitle">Last 500 records</p>
                    <div className="card-actions">
                        <button className="clear-all-btn clear-all-ai" onClick={clearAllAILogs}>
                            🗑️ Clear All
                        </button>
                        <button className="date-range-btn date-range-ai" onClick={() => openDateRangeModal('ai')}>
                            📅 Delete by Date
                        </button>
                    </div>
                </div>

                {/* Top AI Questions Card */}
                <div className="stat-card">
                    <h3>🔥 Popular Questions</h3>
                    {aiStats.topQuestions.length === 0 ? (
                        <p className="no-data">No AI questions yet</p>
                    ) : (
                        <ul className="top-list">
                            {aiStats.topQuestions.map((item, idx) => (
                                <li key={idx} className="top-item ai-question-item">
                                    <span className="rank">#{idx + 1}</span>
                                    <span className="term ai-q-text">"{item.question.substring(0, 60)}..."</span>
                                    <span className="count">{item.count}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Recent AI Questions */}
                <div className="stat-card recent-list">
                    <h3>💬 Recent AI Questions</h3>
                    <div className="log-table-wrapper">
                        {/* Desktop View */}
                        <table className="log-table desktop-only">
                            <thead>
                                <tr>
                                    <th>Time</th>
                                    <th>User</th>
                                    <th>Question</th>
                                </tr>
                            </thead>
                            <tbody>
                                {aiQuestions.slice(0, 20).map((q) => (
                                    <tr
                                        key={q.id}
                                        className="clickable-row"
                                        onClick={() => { setSelectedItem(q); setItemType('ai'); }}
                                    >
                                        <td>{new Date(q.created_at).toLocaleString()}</td>
                                        <td>
                                            <span
                                                className="user-badge clickable-user"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (q.user_id) {
                                                        handleUserClick({ userId: q.user_id, count: 1, device: 'Unknown' });
                                                    }
                                                }}
                                            >
                                                {q.user_id ? q.user_id.substring(0, 8) + '...' : 'Anon'}
                                            </span>
                                        </td>
                                        <td className="ai-q-cell">{q.question.substring(0, 80)}{q.question.length > 80 ? '...' : ''}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Mobile View */}
                        <div className="mobile-cards mobile-only">
                            {aiQuestions.slice(0, 20).map((q) => (
                                <div
                                    key={q.id}
                                    className="log-card clickable-row"
                                    onClick={() => { setSelectedItem(q); setItemType('ai'); }}
                                >
                                    <div className="log-card-header">
                                        <span>{new Date(q.created_at).toLocaleTimeString()}</span>
                                    </div>
                                    <div className="log-card-query ai-q-text">{q.question.substring(0, 100)}{q.question.length > 100 ? '...' : ''}</div>
                                    <div className="log-card-meta">
                                        <span
                                            className="user-badge clickable-user"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (q.user_id) {
                                                    handleUserClick({ userId: q.user_id, count: 1, device: 'Unknown' });
                                                }
                                            }}
                                        >
                                            👤 {q.user_id ? q.user_id.substring(0, 8) + '...' : 'Anon'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Detail Modal */}
            {selectedItem && (
                <div className="detail-modal-overlay" onClick={() => setSelectedItem(null)}>
                    <div className="detail-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="detail-modal-header">
                            <h3>{itemType === 'ai' ? '🤖 AI Question Details' : '🔍 Search Details'}</h3>
                            <button className="close-modal-btn" onClick={() => setSelectedItem(null)}>✕</button>
                        </div>
                        <div className="detail-modal-body">
                            <div className="detail-row">
                                <span className="detail-label">📅 Date & Time:</span>
                                <span className="detail-value">{new Date(selectedItem.created_at).toLocaleString()}</span>
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">👤 User ID:</span>
                                <span className="detail-value user-id-full">{selectedItem.user_id || 'Anonymous'}</span>
                            </div>
                            {itemType === 'search' && (
                                <>
                                    <div className="detail-row">
                                        <span className="detail-label">🔎 Search Query:</span>
                                        <span className="detail-value">{selectedItem.query}</span>
                                    </div>
                                    <div className="detail-row">
                                        <span className="detail-label">📖 Version:</span>
                                        <span className="detail-value">{selectedItem.version}</span>
                                    </div>
                                    <div className="detail-row">
                                        <span className="detail-label">📜 Testament:</span>
                                        <span className="detail-value">{selectedItem.testament || 'All'}</span>
                                    </div>
                                </>
                            )}

                            {itemType === 'ai' && (
                                <>
                                    <div className="detail-row full-width">
                                        <span className="detail-label">❓ Question:</span>
                                        <p className="detail-value question-full">{selectedItem.question}</p>
                                    </div>
                                    {selectedItem.context && (
                                        <div className="detail-row full-width">
                                            <span className="detail-label">📚 Context Provided:</span>
                                            <p className="detail-value context-text">{selectedItem.context}</p>
                                        </div>
                                    )}
                                </>
                            )}

                            {itemType === 'error' && (
                                <>
                                    <div className="detail-row full-width">
                                        <span className="detail-label">🛑 Error Message:</span>
                                        <p className="detail-value error-text-full">{selectedItem.error_message}</p>
                                    </div>
                                    <div className="detail-row full-width">
                                        <span className="detail-label">📱 Device Info:</span>
                                        <div className="code-block">
                                            <pre>{JSON.stringify(selectedItem.device_info, null, 2)}</pre>
                                        </div>
                                    </div>
                                    <div className="detail-row full-width">
                                        <span className="detail-label">📍 URL:</span>
                                        <p className="detail-value">{selectedItem.url}</p>
                                    </div>
                                    {selectedItem.stack_trace && (
                                        <div className="detail-row full-width">
                                            <span className="detail-label">🥞 Stack Trace:</span>
                                            <div className="code-block scroll-block">
                                                <pre>{selectedItem.stack_trace}</pre>
                                                {selectedItem.component_stack && (
                                                    <>
                                                        <hr />
                                                        <pre>{selectedItem.component_stack}</pre>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                        <div className="detail-modal-footer">
                            <button className="delete-entry-btn" onClick={deleteSingleEntry}>
                                🗑️ Delete This Entry
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Date Range Delete Modal */}
            {
                showDateRangeModal && (
                    <div className="detail-modal-overlay" onClick={() => setShowDateRangeModal(false)}>
                        <div className="detail-modal date-range-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="detail-modal-header">
                                <h3>📅 Delete {dateRangeType === 'search' ? 'Search Logs' : 'AI Questions'} by Date</h3>
                                <button className="close-modal-btn" onClick={() => setShowDateRangeModal(false)}>✕</button>
                            </div>
                            <div className="detail-modal-body">
                                <div className="date-input-group">
                                    <label>Start Date:</label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="date-input"
                                    />
                                </div>
                                <div className="date-input-group">
                                    <label>End Date:</label>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="date-input"
                                    />
                                </div>
                                <p className="date-range-info">
                                    ⚠️ All records from {startDate || '(start)'} to {endDate || '(end)'} will be permanently deleted.
                                </p>
                            </div>
                            <div className="detail-modal-footer">
                                <button
                                    className="delete-entry-btn"
                                    onClick={deleteByDateRange}
                                    disabled={!startDate || !endDate}
                                >
                                    🗑️ Delete Records in Range
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* User Detail Modal */}
            {
                selectedUser && (
                    <div className="detail-modal-overlay" onClick={() => setSelectedUser(null)}>
                        <div className="detail-modal user-detail-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="detail-modal-header user-modal-header">
                                <h3>👤 User Analysis</h3>
                                <button className="close-modal-btn" onClick={() => setSelectedUser(null)}>✕</button>
                            </div>
                            <div className="detail-modal-body">
                                {/* Super User Toggle */}
                                <div className="super-user-toggle">
                                    <label className="super-checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={isUserSuper}
                                            onChange={() => toggleSuperUser(selectedUser.userId, isUserSuper)}
                                        />
                                        <span className="super-badge">⭐ Super User</span>
                                        <span className="super-desc">(bypasses rate limits)</span>
                                    </label>
                                </div>

                                <div className="detail-row">
                                    <span className="detail-label">🆔 User ID:</span>
                                    <span className="detail-value user-id-full">{selectedUser.userId || 'Anonymous'}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">⚡ Total Actions:</span>
                                    <span className="detail-value">{selectedUser.count} (Search + AI)</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">📱 Primary Device:</span>
                                    <span className="detail-value">{selectedUser.device}</span>
                                </div>

                                <div className="detail-row full-width">
                                    <span className="detail-label">🕵️ Detected User Agents:</span>
                                    <div className="user-agents-list">
                                        {selectedUser.fullUserAgents && selectedUser.fullUserAgents.length > 0 ? (
                                            selectedUser.fullUserAgents.map((ua, i) => (
                                                <div key={i} className="ua-item">{ua}</div>
                                            ))
                                        ) : (
                                            <p className="no-data-text">No device info recorded.</p>
                                        )}
                                    </div>
                                </div>

                                {/* New History Section */}
                                <div className="history-section">
                                    <h4>🕒 Recent Activity</h4>
                                    {historyLoading ? (
                                        <p className="loading-text">Loading history...</p>
                                    ) : (
                                        <div className="history-lists">
                                            <div className="history-col">
                                                <h5>🔍 Recent Searches</h5>
                                                {selectedUserHistory.searches.length === 0 ? (
                                                    <p className="no-data-text">No recent searches</p>
                                                ) : (
                                                    <ul className="mini-list">
                                                        {selectedUserHistory.searches.map(log => (
                                                            <li key={log.id} className="mini-item">
                                                                <span className="mini-time">{new Date(log.created_at).toLocaleDateString()}</span>
                                                                <span className="mini-text">{log.query}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </div>
                                            <div className="history-col">
                                                <h5>🤖 AI Questions</h5>
                                                {selectedUserHistory.aiQuestions.length === 0 ? (
                                                    <p className="no-data-text">No AI questions</p>
                                                ) : (
                                                    <ul className="mini-list">
                                                        {selectedUserHistory.aiQuestions.map(q => (
                                                            <li key={q.id} className="mini-item">
                                                                <span className="mini-time">{new Date(q.created_at).toLocaleDateString()}</span>
                                                                <span className="mini-text" title={q.question}>{q.question.substring(0, 40)}...</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Delete User Data Buttons */}
                                <div className="delete-user-section">
                                    {!showDeleteConfirm ? (
                                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                            <button
                                                className="delete-user-btn"
                                                onClick={() => setShowDeleteConfirm('data')}
                                            >
                                                🗑️ Delete History Logs
                                            </button>
                                            <button
                                                className="delete-user-btn"
                                                style={{ backgroundColor: '#dc2626' }}
                                                onClick={() => setShowDeleteConfirm('full')}
                                            >
                                                💀 Delete User Fully
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="delete-confirm-box">
                                            <p className="confirm-text">
                                                {showDeleteConfirm === 'full'
                                                    ? '⚠️ NUKE USER? This deletes logs AND removes Super User status. It will happen immediately.'
                                                    : '⚠️ Clear history? This deletes all search/AI logs but keeps the user ID alive.'}
                                            </p>
                                            <div className="confirm-buttons">
                                                <button
                                                    className="confirm-yes-btn"
                                                    onClick={() => showDeleteConfirm === 'full' ? handleDeleteUserFully(selectedUser.userId) : deleteUserData(selectedUser.userId)}
                                                >
                                                    ✓ Yes, Delete
                                                </button>
                                                <button
                                                    className="confirm-no-btn"
                                                    onClick={() => setShowDeleteConfirm(false)}
                                                >
                                                    ✕ Cancel
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Admin Settings Section */}
            <h2 className="section-title">⚙️ Admin Settings</h2>
            <div className="stats-grid">
                <div className="stat-card settings-card">
                    <h3>Blog Rate Limit</h3>
                    <div className="setting-row">
                        <div className="setting-info">
                            <p className="setting-desc">Limit AI devotionals to 1 per user per day</p>
                            <p className="setting-status">
                                Status: <strong>{rateLimitEnabled ? '🔒 Enabled' : '🔓 Disabled'}</strong>
                            </p>
                        </div>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={rateLimitEnabled}
                                onChange={handleToggleRateLimit}
                                disabled={rateLimitLoading}
                            />
                            <span className="slider"></span>
                        </label>
                    </div>
                    <p className="setting-hint">
                        {rateLimitEnabled
                            ? '✅ Users get 1 AI devotional per day (reduces API costs)'
                            : '⚡ Users can generate unlimited devotionals (testing mode)'}
                    </p>

                    {/* New Super User Auto Toggle */}
                    <div className="setting-row" style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #333' }}>
                        <div className="setting-info">
                            <p className="setting-desc">Auto-SuperUser for New Users</p>
                            <p className="setting-status">
                                Status: <strong>{superAutoEnabled ? '🔒 Enabled' : '🔓 Disabled'}</strong>
                            </p>
                        </div>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={superAutoEnabled}
                                onChange={handleToggleSuperAuto}
                                disabled={superAutoLoading}
                            />
                            <span className="slider"></span>
                        </label>
                    </div>
                    <p className="setting-hint">
                        {superAutoEnabled
                            ? '✅ New users automatically become Super Users (no rate limits)'
                            : '⚡ New users start with standard rate limits'}
                    </p>
                </div>
            </div>

            {/* Error Logs Section */}
            <h2 className="section-title">🚨 System Health & Crashes</h2>
            <div className="stats-grid">
                {/* Error Summary Card */}
                <div className="stat-card summary-card error-summary">
                    <h3>Total Crashes</h3>
                    <div className="big-number">{errorLogs.length}</div>
                    <p className="subtitle">Recorded Events</p>
                    <div className="card-actions">
                        {!showClearErrorConfirm ? (
                            <button className="clear-all-btn clear-all-error" onClick={clickClearErrors}>
                                🗑️ Clear All
                            </button>
                        ) : (
                            <div className="confirm-row" style={{ display: 'flex', gap: '5px' }}>
                                <button className="confirm-yes-btn" onClick={confirmClearErrors} style={{ padding: '4px 8px', fontSize: '0.8rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Yes</button>
                                <button className="confirm-no-btn" onClick={() => setShowClearErrorConfirm(false)} style={{ padding: '4px 8px', fontSize: '0.8rem', background: '#555', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>No</button>
                            </div>
                        )}
                        <button className="clear-all-btn" style={{ borderColor: '#fca5a5', color: '#fca5a5' }} onClick={sendTestError}>
                            ⚡ Send Test Crash
                        </button>
                    </div>
                </div>

                {/* Recent Errors List */}
                <div className="stat-card recent-list full-width-card">
                    <h3>🛑 Crash Reports</h3>
                    {errorLogs.length === 0 ? (
                        <p className="no-data">No crashes recorded (System Healthy)</p>
                    ) : (
                        <div className="log-table-wrapper">
                            {/* Desktop Table View */}
                            <table className="log-table desktop-only">
                                <thead>
                                    <tr>
                                        <th>Time</th>
                                        <th>Message</th>
                                        <th>Device</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {errorLogs.map((err) => (
                                        <tr
                                            key={err.id}
                                            className="clickable-row error-row"
                                            onClick={() => { setSelectedItem(err); setItemType('error'); }}
                                            onContextMenu={(e) => handleContextMenu(e, err.error_message)}
                                            onTouchStart={(e) => handleTouchStart(e, err.error_message)}
                                            onTouchEnd={handleTouchEnd}
                                            onTouchMove={handleTouchEnd}
                                        >
                                            <td>{new Date(err.created_at).toLocaleString()}</td>
                                            <td className="error-msg-cell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                                                <span>
                                                    {err.error_message.substring(0, 50)}...
                                                    <span className="ver-badge">Build: {err.metadata?.version || '?'}</span>
                                                </span>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleCopyError(err.error_message);
                                                    }}
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        fontSize: '1.2rem',
                                                        padding: '5px'
                                                    }}
                                                    title="Copy Error"
                                                >
                                                    📋
                                                </button>
                                            </td>
                                            <td>
                                                {err.device_info?.os || 'Unknown'}
                                                {err.device_info?.screen ? ` (${err.device_info.screen.width}x${err.device_info.screen.height})` : ''}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {/* Mobile Card View */}
                            <div className="mobile-cards mobile-only">
                                {errorLogs.map((err) => (
                                    <div
                                        key={err.id}
                                        className="log-card clickable-row error-row"
                                        onClick={() => { setSelectedItem(err); setItemType('error'); }}
                                    >
                                        <div className="log-card-header">
                                            <span>{new Date(err.created_at).toLocaleTimeString()}</span>
                                            <span className="ver-badge">v{err.metadata?.version || '?'}</span>
                                        </div>
                                        <div className="log-card-query error-msg-cell" style={{ fontSize: '0.9rem' }}>
                                            {err.error_message.substring(0, 60)}...
                                        </div>
                                        <div className="log-card-meta">
                                            <span className="user-badge">
                                                📱 {err.device_info?.os || 'Unknown'}
                                            </span>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleCopyError(err.error_message);
                                                }}
                                                style={{
                                                    background: 'rgba(255,255,255,0.1)',
                                                    border: '1px solid var(--border-subtle)',
                                                    borderRadius: '4px',
                                                    padding: '4px'
                                                }}
                                            >
                                                📋 Copy
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {/* Project Credentials Section */}
            <h2 className="section-title">🔑 Project Credentials & Backend</h2>
            <div className="stats-grid">
                <div className="stat-card credentials-card full-width-card">
                    <h3>Project Connections</h3>
                    <div className="credentials-grid">
                        <div className="credential-item">
                            <span className="credential-label">📂 GitHub Repository:</span>
                            <span className="credential-value">
                                <a href="https://github.com/Andre6553/bible-app" target="_blank" rel="noopener noreferrer">
                                    Andre6553/bible-app 🌐
                                </a>
                            </span>
                        </div>
                        <div className="credential-item">
                            <span className="credential-label">🤖 Google Gemini API:</span>
                            <span className="credential-value code-style">
                                {import.meta.env.VITE_GEMINI_API_KEY || 'Not Configured'}
                                <span className="api-url"> (URL: https://generativelanguage.googleapis.com)</span>
                            </span>
                        </div>
                        <div className="credential-item">
                            <span className="credential-label">🛢️ Supabase Backend:</span>
                            <div className="credential-value code-block-small">
                                <p><strong>URL:</strong> {supabaseUrl}</p>
                                <p><strong>Anon Key:</strong> {supabaseKey}</p>
                            </div>
                        </div>
                        <div className="credential-item">
                            <span className="credential-label">🚀 Vercel Deployment:</span>
                            <span className="credential-value">
                                <a href="https://bible-app-phi-one.vercel.app" target="_blank" rel="noopener noreferrer">
                                    bible-app-phi-one.vercel.app 🔗
                                </a>
                            </span>
                        </div>
                    </div>
                    <div className="credential-hint">
                        💡 These keys are managed via environment variables and project configurations.
                    </div>
                </div>
            </div>
        </div >
    );
}

export default Stats;
