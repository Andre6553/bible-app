import { useState, useEffect } from 'react';
import { supabase } from '../config/supabaseClient';
import { getUserStatistics, getUserHistory } from '../services/bibleService';
import { isRateLimitEnabled, toggleRateLimit as toggleRateLimitSetting } from '../services/blogService';
import './Stats.css';

function Stats() {
    const [logs, setLogs] = useState([]);
    const [aiQuestions, setAiQuestions] = useState([]);
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
    const [itemType, setItemType] = useState(null); // 'search' or 'ai'
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

    useEffect(() => {
        // Only fetch if authenticated
        if (isAuthenticated) {
            fetchLogs();
            fetchAIQuestions();
            fetchUserStats();
            fetchRateLimitSetting();
        }
    }, [isAuthenticated]);

    const fetchRateLimitSetting = async () => {
        const enabled = await isRateLimitEnabled();
        setRateLimitEnabled(enabled);
    };

    const handleToggleRateLimit = async () => {
        setRateLimitLoading(true);
        const newValue = !rateLimitEnabled;
        const result = await toggleRateLimitSetting(newValue);
        if (result.success) {
            setRateLimitEnabled(newValue);
        } else {
            alert('Failed to update setting: ' + result.error);
        }
        setRateLimitLoading(false);
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

    const handleUserClick = async (user) => {
        console.group('🔍 Debugging User Value');
        console.log('Selected User Object:', user);
        console.log('Total Local Logs Available:', logs.length);
        console.log('Total Local AI Questions Available:', aiQuestions.length);

        setSelectedUser(user);

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
            // Clear local state immediately
            setAiQuestions([]);
            setAiStats({ total: 0, topQuestions: [] });
            alert('✅ All AI question logs deleted!');
        }
    };

    // Delete single entry
    const deleteSingleEntry = async () => {
        if (!selectedItem) return;

        const table = itemType === 'search' ? 'search_logs' : 'ai_questions';
        const itemDesc = itemType === 'search' ? 'search log' : 'AI question';

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
            } else {
                setAiQuestions(prevQ => prevQ.filter(q => q.id !== selectedItem.id));
                processAIStats(aiQuestions.filter(q => q.id !== selectedItem.id));
            }
            setSelectedItem(null);
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
                        <input
                            type="password"
                            value={pinInput}
                            onChange={(e) => setPinInput(e.target.value)}
                            placeholder="Enter PIN"
                            className="pin-input"
                            autoFocus
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
                <button className="logout-btn" onClick={() => setIsAuthenticated(false)}>Lock 🔒</button>
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
                        <table className="log-table">
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
                                        <td><span className="user-badge">{log.user_id ? log.user_id.substring(0, 8) + '...' : 'Anon'}</span></td>
                                        <td>{log.query}</td>
                                        <td>{log.version}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
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
                    <h3>🏆 Most Active Users</h3>
                    {userStats.topUsers.length === 0 ? (
                        <p className="no-data">No data yet</p>
                    ) : (
                        <ul className="top-list">
                            {userStats.topUsers.map((u, idx) => (
                                <li key={idx} className="top-item clickable-row" onClick={() => handleUserClick(u)}>
                                    <span className="rank">#{idx + 1}</span>
                                    <div className="user-info-col">
                                        <span className="term user-id-term">{u.userId.substring(0, 15)}{u.userId.length > 15 ? '...' : ''}</span>
                                        <span className="device-badge">{u.device}</span>
                                    </div>
                                    <span className="count">{u.count} actions</span>
                                </li>
                            ))}
                        </ul>
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
                        <table className="log-table">
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
                                        <td><span className="user-badge">{q.user_id ? q.user_id.substring(0, 8) + '...' : 'Anon'}</span></td>
                                        <td className="ai-q-cell">{q.question.substring(0, 80)}{q.question.length > 80 ? '...' : ''}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
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
                            {itemType === 'search' ? (
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
                            ) : (
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
            {showDateRangeModal && (
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
            )}

            {/* User Detail Modal */}
            {selectedUser && (
                <div className="detail-modal-overlay" onClick={() => setSelectedUser(null)}>
                    <div className="detail-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="detail-modal-header user-modal-header">
                            <h3>👤 User Analysis</h3>
                            <button className="close-modal-btn" onClick={() => setSelectedUser(null)}>✕</button>
                        </div>
                        <div className="detail-modal-body">
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
                        </div>
                    </div>
                </div>
            )}

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
                </div>
            </div>
        </div>
    );
}

export default Stats;
