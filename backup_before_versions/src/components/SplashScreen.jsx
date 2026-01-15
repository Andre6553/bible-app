import React, { useEffect, useState } from 'react';
import './SplashScreen.css';

const SplashScreen = () => {
    const [fadeOut, setFadeOut] = useState(false);

    useEffect(() => {
        // Start fade out animation slightly before the 2s mark
        const timer = setTimeout(() => {
            setFadeOut(true);
        }, 2200);

        return () => clearTimeout(timer);
    }, []);

    return (
        <div className={`splash-screen ${fadeOut ? 'fade-out' : ''}`}>
            <div className="splash-bg-glow"></div>
            <div className="splash-content">
                <img
                    src="/splash_logo.png"
                    alt="Omni Bible Logo"
                    className="splash-logo"
                />
                <h1 className="splash-name">Omni Bible</h1>
                <span className="splash-tagline">Study • Meditate • Grow</span>
            </div>
        </div>
    );
};

export default SplashScreen;
