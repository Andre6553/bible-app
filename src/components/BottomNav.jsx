import { NavLink, useNavigate } from 'react-router-dom';
import { useRef } from 'react';
import { useSettings } from '../context/SettingsContext';
import './BottomNav.css';

function BottomNav() {
    const navigate = useNavigate();
    const { settings } = useSettings();
    const clickTracker = useRef({ count: 0, lastTime: 0 });

    const translations = {
        en: {
            bible: "Bible",
            search: "Search",
            study: "Study",
            foryou: "For You",
            profile: "Profile"
        },
        af: {
            bible: "Bybel",
            search: "Soek",
            study: "Studie",
            foryou: "Vir Jou",
            profile: "Profiel"
        }
    };

    const t = translations[settings.language] || translations.en;

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
                <span className="nav-label">{t.bible}</span>
            </NavLink>

            <NavLink
                to="/search"
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
                <span className="nav-icon">🔍</span>
                <span className="nav-label">{t.search}</span>
            </NavLink>

            <NavLink
                to="/study"
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
                <span className="nav-icon">✍️</span>
                <span className="nav-label">{t.study}</span>
            </NavLink>

            <NavLink
                to="/blog"
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
                <span className="nav-icon">✨</span>
                <span className="nav-label">{t.foryou}</span>
            </NavLink>

            <NavLink
                to="/profile"
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                onClick={handleProfileClick}
            >
                <span className="nav-icon">👤</span>
                <span className="nav-label">{t.profile}</span>
            </NavLink>
        </nav>
    );
}

export default BottomNav;
