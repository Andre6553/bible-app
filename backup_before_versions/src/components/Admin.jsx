import React, { useState, useEffect } from 'react';
import { getApiUsageStats, getUserDetailsByEmail } from '../services/adminService';
import { useSettings } from '../context/SettingsContext';
import { useNavigate } from 'react-router-dom';
import './Admin.css';

const Admin = () => {
    const [stats, setStats] = useState([]);
    const [loading, setLoading] = useState(false);
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30); // Default last 30 days
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
    const { settings, profile } = useSettings();
    const navigate = useNavigate();

    // Authentication state
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [authError, setAuthError] = useState(false);

    useEffect(() => {
        // [PRODUCTION HARDENING] Use Identity-Based Access instead of PIN
        if (profile?.subscription_override === 'admin') {
            setIsAuthenticated(true);
        } else {
            setIsAuthenticated(false);
        }
    }, [profile]);

    useEffect(() => {
        // Only fetch if authenticated
        if (isAuthenticated) {
            fetchStats();
        }
    }, [isAuthenticated, startDate, endDate]);

    const fetchStats = async () => {
        setLoading(true);
        const start = new Date(startDate);
        const end = new Date(endDate);
        // Adjust end date to be end of day
        end.setHours(23, 59, 59, 999);

        const result = await getApiUsageStats(start, end);
        if (result.success) {
            setStats(result.data);
        }
        setLoading(false);
    };

    // Calculate aggregations
    const totalCalls = stats.length;
    const successCount = stats.filter(s => s.status === 'success').length;
    const errorCount = stats.filter(s => s.status === 'error').length;

    // By Endpoint
    const byEndpoint = stats.reduce((acc, curr) => {
        let key = curr.endpoint;

        // Granular breakdown for Sermon AI
        if (curr.endpoint === 'performResearch' && curr.metadata?.tool) {
            key = `AI: ${curr.metadata.tool}`;
        } else if (curr.endpoint === 'generateExegesis') {
            key = 'AI: Sermon Skeleton';
        }

        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});

    // If not authenticated, show Access Denied screen
    if (!isAuthenticated) {
        return (
            <div className="stats-login-container" style={{ textAlign: 'center', padding: '100px 20px', minHeight: '100vh', background: settings.theme === 'dark' ? '#1a1a2e' : '#f5f5f5' }}>
                <div className="stats-login-card" style={{ maxWidth: '400px', margin: '0 auto', background: settings.theme === 'dark' ? '#333' : '#fff', padding: '40px', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
                    <h2 style={{ fontSize: '3rem', marginBottom: '20px' }}>🔒</h2>
                    <h2 style={{ marginBottom: '10px', color: settings.theme === 'dark' ? '#fff' : '#333' }}>Access Denied</h2>
                    <p style={{ opacity: 0.7, marginBottom: '30px', color: settings.theme === 'dark' ? '#ccc' : '#666' }}>
                        This area is restricted to administrators. Please log in with an authorized account to continue.
                    </p>
                    <button
                        onClick={() => navigate('/')}
                        style={{ padding: '12px 24px', background: '#4a90d9', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', width: '100%' }}
                    >
                        Return Home
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={`admin-container ${settings.theme === 'dark' ? 'dark-mode' : 'light-mode'}`}>
            <div className="admin-header">
                <h1>API Usage Dashboard</h1>
                <div className="admin-header-buttons">
                    <button className="btn-back" onClick={() => navigate('/')}>
                        Back to App
                    </button>
                </div>
            </div>

            <div className="admin-controls user-lookup-section" style={{
                background: settings.theme === 'dark' ? '#2d2d44' : '#fff',
                padding: '24px',
                borderRadius: '12px',
                marginBottom: '30px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}>
                <h3 style={{ marginTop: 0, marginBottom: '16px' }}>🔍 User Limit Lookup</h3>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                    <input
                        type="email"
                        placeholder="Enter user email (e.g. omnibible@gmail.com)"
                        style={{
                            flex: 1,
                            padding: '10px 16px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)',
                            fontSize: '1rem',
                            background: settings.theme === 'dark' ? '#1f2937' : '#f9fafb',
                            color: settings.theme === 'dark' ? '#ffffff' : '#111827'
                        }}
                        onKeyDown={async (e) => {
                            if (e.key === 'Enter') {
                                const email = e.target.value;
                                if (!email) return;
                                const btn = e.target.nextSibling;
                                btn.click();
                            }
                        }}
                    />
                    <button
                        className="btn-primary"
                        style={{
                            padding: '10px 20px',
                            background: '#7c3aed',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                        onClick={async (e) => {
                            const input = e.target.previousSibling;
                            if (!input.value) return;
                            const res = await getUserDetailsByEmail(input.value);
                            if (res.success) {
                                let msg = `🔍 Found ${res.data.length} profile(s):\n`;
                                res.data.forEach((p, index) => {
                                    msg += `\n-----------------------\n`;
                                    msg += `Profile #${index + 1}\n`;
                                    msg += `🆔 ID: ${p.user_id}\n`;
                                    msg += `💎 Tier: ${p.subscription_tier || 'Free'}\n`;
                                    msg += `🔑 Override: ${p.subscription_override || 'None'}\n`;
                                    msg += `📊 Usage: ${p.ai_usage_count || 0}\n`;
                                    msg += `📅 Last Seen: ${p.last_seen ? new Date(p.last_seen).toLocaleDateString() : 'N/A'}`;
                                });
                                alert(msg);
                            } else {
                                alert(res.error);
                            }
                        }}
                    >
                        Check Status
                    </button>
                </div>
            </div>

            <div className="admin-controls">
                <div className="control-group">
                    <label>
                        Start Date:
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                    </label>
                </div>
                <div className="control-group">
                    <label>
                        End Date:
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </label>
                </div>
            </div>

            {loading ? (
                <div className="loading">Loading stats...</div>
            ) : (
                <div className="admin-stats">
                    {/* Summary Cards */}
                    <div className="stats-grid">
                        <div className="stat-card">
                            <h3>Total Calls</h3>
                            <p className="stat-value">{totalCalls}</p>
                        </div>
                        <div className="stat-card">
                            <h3>Success Rate</h3>
                            <p className="stat-value success">
                                {totalCalls > 0 ? Math.round((successCount / totalCalls) * 100) : 0}%
                            </p>
                        </div>
                        <div className="stat-card">
                            <h3>Errors</h3>
                            <p className="stat-value error">{errorCount}</p>
                        </div>
                    </div>

                    {/* API Distribution Section */}
                    <div className="stat-card distribution-card" style={{ marginTop: '20px', padding: '20px' }}>
                        <h3>📊 API Ecosystem Distribution</h3>
                        {(() => {
                            const sermonApiCount = stats.filter(s => s.endpoint === 'generateExegesis' || s.endpoint === 'performResearch').length;
                            const appApiCount = totalCalls - sermonApiCount;
                            const sermonPercent = totalCalls > 0 ? Math.round((sermonApiCount / totalCalls) * 100) : 0;
                            const appPercent = totalCalls > 0 ? 100 - sermonPercent : 0;

                            return (
                                <>
                                    <div className="distribution-bar" style={{ display: 'flex', height: '30px', borderRadius: '15px', overflow: 'hidden', margin: '20px 0', background: '#333' }}>
                                        <div style={{ width: `${sermonPercent}%`, background: 'linear-gradient(90deg, #8b5cf6, #d946ef)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '0.85rem', transition: 'width 0.5s ease' }}>
                                            {sermonPercent > 5 && `${sermonPercent}%`}
                                        </div>
                                        <div style={{ width: `${appPercent}%`, background: 'linear-gradient(90deg, #3b82f6, #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '0.85rem', transition: 'width 0.5s ease' }}>
                                            {appPercent > 5 && `${appPercent}%`}
                                        </div>
                                    </div>
                                    <div className="distribution-legend" style={{ display: 'flex', justifyContent: 'center', gap: '40px', fontSize: '1rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span style={{ width: '16px', height: '16px', borderRadius: '4px', background: 'linear-gradient(90deg, #8b5cf6, #d946ef)' }}></span>
                                            <span><strong>Sermon API:</strong> {sermonApiCount}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span style={{ width: '16px', height: '16px', borderRadius: '4px', background: 'linear-gradient(90deg, #3b82f6, #06b6d4)' }}></span>
                                            <span><strong>App API:</strong> {appApiCount}</span>
                                        </div>
                                    </div>
                                </>
                            );
                        })()}
                    </div>

                    <div className="details-grid">
                        {/* Usage by Endpoint */}
                        <div className="chart-section">
                            <h3>Usage by Endpoint</h3>
                            <ul className="endpoint-list">
                                {Object.entries(byEndpoint).map(([endpoint, count]) => (
                                    <li key={endpoint} className="endpoint-item">
                                        <span>{endpoint}</span>
                                        <span className="endpoint-count">{count}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Recent Calls Log */}
                        <div className="log-section">
                            <h3>Recent Calls</h3>
                            <div className="log-table-wrapper">
                                <table className="log-table">
                                    <thead>
                                        <tr>
                                            <th>Time</th>
                                            <th>Endpoint</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stats.slice(0, 50).map((log) => (
                                            <tr key={log.id}>
                                                <td>{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                                <td>
                                                    {log.endpoint}
                                                    {log.metadata?.tool && <span style={{ fontSize: '0.8em', opacity: 0.7, display: 'block' }}>Goal: {log.metadata.tool}</span>}
                                                </td>
                                                <td className={`status-${log.status}`}>{log.status}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Admin;

