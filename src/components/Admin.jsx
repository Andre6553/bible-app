import React, { useState, useEffect } from 'react';
import { getApiUsageStats } from '../services/adminService';
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
    const { settings } = useSettings();
    const navigate = useNavigate();

    // Authentication state
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [pinInput, setPinInput] = useState('');
    const [authError, setAuthError] = useState(false);

    useEffect(() => {
        // Only fetch if authenticated
        if (isAuthenticated) {
            fetchStats();
        }
    }, [isAuthenticated, startDate, endDate]);

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
        acc[curr.endpoint] = (acc[curr.endpoint] || 0) + 1;
        return acc;
    }, {});

    // If not authenticated, show login screen
    if (!isAuthenticated) {
        return (
            <div className="stats-login-container" style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '100vh',
                background: settings.theme === 'dark' ? '#1a1a2e' : '#f5f5f5'
            }}>
                <div className="stats-login-card" style={{
                    background: settings.theme === 'dark' ? '#333' : '#fff',
                    padding: '40px',
                    borderRadius: '12px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                    textAlign: 'center',
                    minWidth: '300px'
                }}>
                    <h2 style={{ marginBottom: '20px', color: settings.theme === 'dark' ? '#fff' : '#333' }}>
                        Admin Access 🔒
                    </h2>
                    <form onSubmit={handleLogin}>
                        <input
                            type="password"
                            value={pinInput}
                            onChange={(e) => setPinInput(e.target.value)}
                            placeholder="Enter PIN"
                            className="pin-input"
                            autoFocus
                            style={{
                                width: '100%',
                                padding: '12px',
                                fontSize: '18px',
                                textAlign: 'center',
                                border: authError ? '2px solid #f44336' : '2px solid #ddd',
                                borderRadius: '8px',
                                marginBottom: '10px',
                                background: settings.theme === 'dark' ? '#444' : '#fff',
                                color: settings.theme === 'dark' ? '#fff' : '#333'
                            }}
                        />
                        {authError && <p style={{ color: '#f44336', margin: '10px 0' }}>Incorrect PIN</p>}
                        <button
                            type="submit"
                            style={{
                                width: '100%',
                                padding: '12px',
                                fontSize: '16px',
                                background: '#4a90d9',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                marginTop: '10px'
                            }}
                        >
                            Unlock
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="admin-container" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', color: settings.theme === 'dark' ? '#fff' : '#333' }}>
            <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h1>API Usage Dashboard</h1>
                <div>
                    <button onClick={() => setIsAuthenticated(false)} style={{ padding: '8px 16px', background: '#666', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '10px' }}>
                        Lock 🔒
                    </button>
                    <button onClick={() => navigate('/')} style={{ padding: '8px 16px', background: 'var(--primary-color)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                        Back to App
                    </button>
                </div>
            </div>

            <div className="admin-controls" style={{ marginBottom: '20px', padding: '15px', background: settings.theme === 'dark' ? '#333' : '#f5f5f5', borderRadius: '8px' }}>
                <label style={{ marginRight: '10px' }}>
                    Start Date:
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        style={{ marginLeft: '5px', padding: '5px' }}
                    />
                </label>
                <label>
                    End Date:
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        style={{ marginLeft: '5px', padding: '5px' }}
                    />
                </label>
            </div>

            {loading ? (
                <div className="loading">Loading stats...</div>
            ) : (
                <div className="admin-stats">
                    {/* Summary Cards */}
                    <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
                        <div className="stat-card" style={{ background: settings.theme === 'dark' ? '#444' : '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                            <h3>Total Calls</h3>
                            <p style={{ fontSize: '2em', fontWeight: 'bold' }}>{totalCalls}</p>
                        </div>
                        <div className="stat-card" style={{ background: settings.theme === 'dark' ? '#444' : '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                            <h3>Success Rate</h3>
                            <p style={{ fontSize: '2em', fontWeight: 'bold', color: '#4caf50' }}>
                                {totalCalls > 0 ? Math.round((successCount / totalCalls) * 100) : 0}%
                            </p>
                        </div>
                        <div className="stat-card" style={{ background: settings.theme === 'dark' ? '#444' : '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                            <h3>Errors</h3>
                            <p style={{ fontSize: '2em', fontWeight: 'bold', color: '#f44336' }}>{errorCount}</p>
                        </div>
                    </div>

                    <div className="details-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        {/* Usage by Endpoint */}
                        <div className="chart-section" style={{ background: settings.theme === 'dark' ? '#444' : '#fff', padding: '20px', borderRadius: '8px' }}>
                            <h3>Usage by Endpoint</h3>
                            <ul style={{ listStyle: 'none', padding: 0 }}>
                                {Object.entries(byEndpoint).map(([endpoint, count]) => (
                                    <li key={endpoint} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee' }}>
                                        <span>{endpoint}</span>
                                        <strong>{count}</strong>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Recent Calls Log */}
                        <div className="log-section" style={{ background: settings.theme === 'dark' ? '#444' : '#fff', padding: '20px', borderRadius: '8px' }}>
                            <h3>Recent Calls</h3>
                            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ textAlign: 'left' }}>
                                            <th style={{ padding: '8px' }}>Time</th>
                                            <th style={{ padding: '8px' }}>Endpoint</th>
                                            <th style={{ padding: '8px' }}>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stats.slice(0, 50).map((log) => (
                                            <tr key={log.id} style={{ borderBottom: '1px solid #eee' }}>
                                                <td style={{ padding: '8px' }}>{new Date(log.created_at).toLocaleTimeString()}</td>
                                                <td style={{ padding: '8px' }}>{log.endpoint}</td>
                                                <td style={{ padding: '8px', color: log.status === 'success' ? 'green' : 'red' }}>{log.status}</td>
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

