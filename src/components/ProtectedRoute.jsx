import { Navigate, useLocation } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';

export default function ProtectedRoute({ children, admin = false }) {
    const { user, authLoading, profile, profileLoading } = useSettings();
    const location = useLocation();
    if (authLoading || (admin && user && profileLoading)) {
        return <div role="status" className="loading-state">Checking your account...</div>;
    }
    if (!user) {
        const next = location.pathname + location.search + location.hash;
        return <Navigate to={`/auth?next=${encodeURIComponent(next)}`} replace />;
    }
    if (admin && (profile?.user_id !== user.id || profile?.subscription_override !== 'admin')) return <Navigate to="/profile" replace />;
    return children;
}
