
import { useState, useEffect } from 'react';
import { supabase } from '../config/supabaseClient';
import './Stats.css';

function Stats() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);


    const [stats, setStats] = useState({ total: 0, topTerms: [] });
    // Authentication
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [pinInput, setPinInput] = useState('');
    const [authError, setAuthError] = useState(false);

    useEffect(() => {
        // Only fetch if authenticated
        if (isAuthenticated) {
            fetchLogs();
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
                                    <tr key={log.id}>
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
        </div>
    );
}

export default Stats;
