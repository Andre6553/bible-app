import { NavLink } from 'react-router-dom';
import './BottomNav.css';

function BottomNav() {
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
                to="/blog"
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
                <span className="nav-icon">📝</span>
                <span className="nav-label">For You</span>
            </NavLink>
        </nav>
    );
}

export default BottomNav;
