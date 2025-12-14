
import { useState, useEffect } from 'react';
import { supabase } from '../config/supabaseClient';
import './Stats.css';

function Stats() {
    const [logs, setLogs] = useState([]);
    const [aiQuestions, setAiQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);


    const [stats, setStats] = useState({ total: 0, topTerms: [] });
    const [aiStats, setAiStats] = useState({ total: 0, topQuestions: [] });
    // Modal for detail view
    const [selectedItem, setSelectedItem] = useState(null);
    const [itemType, setItemType] = useState(null); // 'search' or 'ai'
    // Authentication
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [pinInput, setPinInput] = useState('');
    const [authError, setAuthError] = useState(false);

    useEffect(() => {
        // Only fetch if authenticated
        if (isAuthenticated) {
            fetchLogs();
            fetchAIQuestions();
        }
    }, [isAuthenticated]);

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

    const fetchLogs = async () => {
        setLoading(true);
        // Fetch last 1000 logs
        const { data, error } = await supabase
            .from('search_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1000);

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
            .limit(500);

        if (error) {
            console.error("Error fetching AI questions:", error);
            return;
        }

        processAIStats(data);
        setAiQuestions(data);
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

            {/* AI Questions Section */}
            <h2 className="section-title">🤖 AI Research Analytics</h2>
            <div className="stats-grid">
                {/* AI Summary Card */}
                <div className="stat-card summary-card ai-summary">
                    <h3>Total AI Questions</h3>
                    <div className="big-number">{aiStats.total}</div>
                    <p className="subtitle">Last 500 records</p>
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
                    </div>
                </div>
            )}
        </div>
    );
}

export default Stats;
