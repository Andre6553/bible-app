import { useState, useEffect } from 'react';
import { supabase } from '../config/supabaseClient';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { migrateAnonymousData } from '../services/migrationService';
import { sendWelcomeEmail, notifyAdminOfNewUser } from '../services/emailService';
import './Auth.css';

function Auth() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [authMode, setAuthMode] = useState('login'); // 'login', 'signup', 'forgotPassword', 'updatePassword'
    const [error, setError] = useState(null);
    const [message, setMessage] = useState(null);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // Check for recovery type in URL
    useEffect(() => {
        if (searchParams.get('type') === 'recovery') {
            setAuthMode('updatePassword');
        }
    }, [searchParams]);

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            let result;
            if (authMode === 'signup') {
                result = await supabase.auth.signUp({
                    email,
                    password,
                });
            } else {
                result = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
            }

            if (result.error) throw result.error;

            if (result.data?.user) {
                console.log('Auth success, starting migration...');
                setLoading(false); // Auth is done
                setIsSyncing(true); // Now syncing data

                if (authMode === 'signup') {
                    sendWelcomeEmail(email);
                    notifyAdminOfNewUser(result.data.user.id, email);
                }

                try {
                    await migrateAnonymousData(result.data.user.id);
                } catch (migErr) {
                    console.error('Migration failed but proceeding to profile:', migErr);
                }

                // Short delay to ensure context catches up
                setTimeout(() => {
                    navigate('/profile');
                }, 500);
            } else if (authMode === 'signup') {
                sendWelcomeEmail(email);
                notifyAdminOfNewUser('Pending', email);
                alert('Success! Please check your email for the confirmation link.');
                setAuthMode('login');
                setLoading(false);
            }

        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    };

    const handleResetRequest = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/auth?type=recovery`,
            });
            if (error) throw error;
            setMessage('Password reset link sent! Please check your email.');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdatePassword = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            });
            if (error) throw error;
            setMessage('Password updated successfully! Redirecting...');
            setTimeout(() => navigate('/profile'), 2000);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-header">
                    <h1>
                        {authMode === 'signup' && 'Create Account'}
                        {authMode === 'login' && 'Welcome Back'}
                        {authMode === 'forgotPassword' && 'Reset Password'}
                        {authMode === 'updatePassword' && 'New Password'}
                    </h1>
                    <p>
                        {authMode === 'signup' && 'Join our community to sync your studies'}
                        {authMode === 'login' && 'Login to access your notes on any device'}
                        {authMode === 'forgotPassword' && "We'll send a secure link to your email"}
                        {authMode === 'updatePassword' && 'Enter your new secure password'}
                    </p>
                </div>

                {isSyncing ? (
                    <div className="auth-syncing-state">
                        <div className="sync-spinner"></div>
                        <h2>Syncing your Bible studies...</h2>
                        <p>We're moving your highlights and notes to your account. This will only take a moment.</p>
                        <style>{`
                            .auth-syncing-state {
                                padding: 40px 20px;
                                text-align: center;
                                animation: fadeIn 0.5s ease;
                            }
                            .sync-spinner {
                                width: 50px;
                                height: 50px;
                                border: 4px solid var(--border-color);
                                border-top: 4px solid var(--accent-primary);
                                border-radius: 50%;
                                margin: 0 auto 20px;
                                animation: spin 1s linear infinite;
                            }
                            @keyframes spin {
                                0% { transform: rotate(0deg); }
                                100% { transform: rotate(360deg); }
                            }
                            @keyframes fadeIn {
                                from { opacity: 0; transform: translateY(10px); }
                                to { opacity: 1; transform: translateY(0); }
                            }
                        `}</style>
                    </div>
                ) : (
                    <>
                        {authMode !== 'updatePassword' && authMode !== 'forgotPassword' && (
                            <form onSubmit={handleAuth} className="auth-form">
                                <div className="form-group">
                                    <label>Email Address</label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="your@email.com"
                                        required
                                        autoComplete="email"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Password</label>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Minimum 6 characters"
                                        required
                                        autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                                    />
                                    {authMode === 'login' && (
                                        <button
                                            type="button"
                                            className="forgot-password-link"
                                            onClick={() => setAuthMode('forgotPassword')}
                                        >
                                            Forgot Password?
                                        </button>
                                    )}
                                </div>

                                {error && <div className="auth-error">{error}</div>}
                                {message && <div className="auth-message">{message}</div>}

                                <button type="submit" className="auth-submit-btn" disabled={loading}>
                                    {loading ? 'Processing...' : (authMode === 'signup' ? 'Sign Up' : 'Log In')}
                                </button>
                            </form>
                        )}

                        {authMode === 'forgotPassword' && (
                            <form onSubmit={handleResetRequest} className="auth-form">
                                <div className="form-group">
                                    <label>Email Address</label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="your@email.com"
                                        required
                                        autoComplete="email"
                                    />
                                </div>

                                {error && <div className="auth-error">{error}</div>}
                                {message && <div className="auth-message">{message}</div>}

                                <button type="submit" className="auth-submit-btn" disabled={loading}>
                                    {loading ? 'Sending Link...' : 'Send Reset Link'}
                                </button>
                                <button
                                    type="button"
                                    className="back-to-login-btn"
                                    onClick={() => setAuthMode('login')}
                                >
                                    Back to Login
                                </button>
                            </form>
                        )}

                        {authMode === 'updatePassword' && (
                            <form onSubmit={handleUpdatePassword} className="auth-form">
                                <div className="form-group">
                                    <label>New Password</label>
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="Minimum 6 characters"
                                        required
                                        autoComplete="new-password"
                                        autoFocus
                                    />
                                </div>

                                {error && <div className="auth-error">{error}</div>}
                                {message && <div className="auth-message">{message}</div>}

                                <button type="submit" className="auth-submit-btn" disabled={loading}>
                                    {loading ? 'Updating...' : 'Update Password'}
                                </button>
                            </form>
                        )}

                        <div className="auth-footer">
                            {authMode !== 'updatePassword' && authMode !== 'forgotPassword' && (
                                <button
                                    className="toggle-auth-btn"
                                    onClick={() => setAuthMode(authMode === 'signup' ? 'login' : 'signup')}
                                >
                                    {authMode === 'signup' ? 'Already have an account? Log In' : "Don't have an account? Sign Up"}
                                </button>
                            )}

                            <button className="back-btn" onClick={() => navigate('/profile')}>
                                Back to Profile
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default Auth;
