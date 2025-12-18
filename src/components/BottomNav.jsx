import { NavLink, useNavigate } from 'react-router-dom';
import { useRef } from 'react';
import './BottomNav.css';

function BottomNav() {
    const navigate = useNavigate();
    const clickTracker = useRef({ count: 0, lastTime: 0 });

    const handleProfileClick = (e) => {
        const now = Date.now();
        const timeDiff = now - clickTracker.current.lastTime;

        // Reset if too slow (more than 500ms between clicks)
        if (timeDiff > 500 && clickTracker.current.count > 0) {
            clickTracker.current.count = 0;
        }

        clickTracker.current.count++;
        clickTracker.current.lastTime = now;

        console.log(`Profile clicks: ${clickTracker.current.count}`);

        if (clickTracker.current.count >= 5) {
            e.preventDefault(); // Stop navigation to profile
            clickTracker.current.count = 0; // Reset
            navigate('/stats');
            // Optional: Provide feedback like vibration or toast
            if (navigator.vibrate) navigator.vibrate(200);
        }
    };

    return (
        <nav className="bottom-nav">
            <NavLink
                to="/bible"
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
                <span className="nav-icon">📖</span>
                <span className="nav-label">Bible</span>
            </NavLink>

            <NavLink
                to="/search"
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
                <span className="nav-icon">🔍</span>
                <span className="nav-label">Search</span>
            </NavLink>

            <NavLink
                to="/study"
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
                <span className="nav-icon">✍️</span>
                <span className="nav-label">Study</span>
            </NavLink>

            <NavLink
                to="/blog"
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
                <span className="nav-icon">✨</span>
                <span className="nav-label">For You</span>
            </NavLink>

            <NavLink
                to="/profile"
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                onClick={handleProfileClick}
            >
                <span className="nav-icon">👤</span>
                <span className="nav-label">Profile</span>
            </NavLink>
        </nav>
    );
}

export default BottomNav;
