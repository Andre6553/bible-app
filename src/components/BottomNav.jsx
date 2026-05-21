import { NavLink, useNavigate } from 'react-router-dom';
import { useRef } from 'react';
import { useSettings } from '../context/SettingsContext';
import { logActivity } from '../services/bibleService';
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
            plans: "Plans",
            foryou: "For You",
            profile: "Profile"
        },
        af: {
            bible: "Bybel",
            search: "Soek",
            study: "Studie",
            plans: "Planne",
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
                onClick={() => {
                    // Dispatch custom event to exit reader mode if active
                    window.dispatchEvent(new CustomEvent('exit-reader-mode'));
                }}
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
                to="/plans"
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                onClick={() => logActivity('plans_nav_click')}
            >
                <span className="nav-icon">📅</span>
                <span className="nav-label">{t.plans}</span>
            </NavLink>

            <NavLink
                to="/blog"
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                onClick={() => logActivity('blog_visit')}
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
