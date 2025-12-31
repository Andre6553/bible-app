import React, { useState, useRef, useEffect } from 'react';
import { toPng } from 'html-to-image';
import './ShareImageModal.css';

const THEMES = [
    { id: 'ocean', name: 'Ocean', bg: 'url("https://images.unsplash.com/photo-1505118380757-91f5f5632de0?q=80&w=800&auto=format&fit=crop")' },
    { id: 'sunset', name: 'Sunset', bg: 'url("https://images.unsplash.com/photo-1472120435266-531128438474?q=80&w=800&auto=format&fit=crop")' },
    { id: 'nature', name: 'Forest', bg: 'url("https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=800&auto=format&fit=crop")' },
    { id: 'mountain', name: 'Peak', bg: 'url("https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=800&auto=format&fit=crop")' },
    { id: 'stars', name: 'Stars', bg: 'url("https://images.unsplash.com/photo-1519681393798-3828fb4090bb?q=80&w=800&auto=format&fit=crop")' },
    { id: 'clouds', name: 'Clouds', bg: 'url("https://images.unsplash.com/photo-1534088568595-a066f410bcda?q=80&w=800&auto=format&fit=crop")' },
    { id: 'desert', name: 'Desert', bg: 'url("https://images.unsplash.com/photo-1473580044384-7ba9967e16a0?q=80&w=800&auto=format&fit=crop")' },
    { id: 'flowers', name: 'Flora', bg: 'url("https://images.unsplash.com/photo-1490750967868-58cb75062ed0?q=80&w=800&auto=format&fit=crop")' },
    { id: 'rain', name: 'Rain', bg: 'url("https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?q=80&w=800&auto=format&fit=crop")' },
    { id: 'wheat', name: 'Harvest', bg: 'url("https://images.unsplash.com/photo-1438962136829-452260720431?q=80&w=800&auto=format&fit=crop")' },
    { id: 'bible', name: 'Bible', bg: 'url("https://images.unsplash.com/photo-1499572620708-2508170d769c?q=80&w=800&auto=format&fit=crop")' },
    { id: 'dark', name: 'Dark', bg: 'linear-gradient(135deg, #232526 0%, #414345 100%)' },
    { id: 'light', name: 'Clean', bg: '#f5f5f5' } // Replaced pure white with off-white for better visibility
];

const TEXT_COLORS = [
    { name: 'White', value: '#ffffff' },
    { name: 'Black', value: '#000000' },
    { name: 'Gold', value: '#ffd700' },
    { name: 'Navy', value: '#000080' }
];

const STROKE_COLORS = [
    { name: 'None', value: 'transparent' },
    { name: 'Black', value: 'rgba(0,0,0,0.8)' },
    { name: 'White', value: 'rgba(255,255,255,0.8)' }
];

function ShareImageModal({ verses, bookName, chapter, onClose, language = 'en' }) {
    // Styling State
    const [selectedTheme, setSelectedTheme] = useState(THEMES[0]);
    const [font, setFont] = useState('modern'); // 'modern' | 'classic'
    const [blurLevel, setBlurLevel] = useState(0); // 0-10px
    const [textSize, setTextSize] = useState(1.4); // rem
    const [textColor, setTextColor] = useState('#ffffff');
    const [strokeColor, setStrokeColor] = useState('transparent');

    // UI State
    const [activeTab, setActiveTab] = useState('theme'); // 'theme' | 'style'
    const [loading, setLoading] = useState(false);

    const cardRef = useRef(null);
    const isAfrikaans = language === 'af';

    // Preload images for snappier switching
    useEffect(() => {
        THEMES.forEach(theme => {
            if (theme.bg.includes('url')) {
                const img = new Image();
                img.src = theme.bg.match(/url\("([^"]+)"\)/)[1];
            }
        });
    }, []);

    const handleShare = async () => {
        if (!cardRef.current) return;
        setLoading(true);

        try {
            const dataUrl = await toPng(cardRef.current, {
                cacheBust: true,
                pixelRatio: 2, // High res
                useCORS: true,
                proxy: "https://cors-anywhere.herokuapp.com/"
            });

            // Blob conversion
            const response = await fetch(dataUrl);
            const blob = await response.blob();
            const file = new File([blob], `verse_image.png`, { type: 'image/png' });

            if (navigator.share) {
                await navigator.share({
                    files: [file],
                    title: 'Bibelvers',
                    text: `${bookName} ${chapter}`
                });
            } else {
                const link = document.createElement('a');
                link.download = `omnibible_${bookName}_${chapter}.png`;
                link.href = dataUrl;
                link.click();
            }
            onClose();
        } catch (error) {
            console.error('Error generating image:', error);
            alert('Could not generate image. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="share-modal-overlay" onClick={onClose}>
            <div className="share-modal-content" onClick={e => e.stopPropagation()}>
                <div className="share-modal-header">
                    <h3>{isAfrikaans ? 'Redigeer Vers' : 'Design Verse'} 🎨</h3>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>

                <div className="share-preview-container">
                    <div
                        ref={cardRef}
                        className={`share-card font-${font}`}
                    >
                        {/* Separate BG layer for Blur Effect */}
                        <div
                            className="share-card-bg"
                            style={{
                                background: selectedTheme.bg,
                                filter: `blur(${blurLevel}px) brightness(0.9)`
                            }}
                        />

                        <div className="share-card-body">
                            {verses.map((v) => (
                                <p
                                    key={v.id}
                                    className="share-verse-text"
                                    style={{
                                        color: textColor,
                                        fontSize: `${textSize}rem`,
                                        WebkitTextStroke: strokeColor === 'transparent' ? '0' : `1px ${strokeColor}`,
                                        textShadow: strokeColor === 'transparent' ? '0 2px 10px rgba(0,0,0,0.5)' : 'none'
                                    }}
                                >
                                    <sup className="share-verse-num" style={{ color: textColor, opacity: 0.8 }}>{v.verse}</sup>
                                    {v.text}
                                </p>
                            ))}
                        </div>

                        <div className="share-card-footer" style={{ borderTopColor: textColor, opacity: 0.9 }}>
                            <span className="share-ref" style={{ color: textColor }}>{bookName} {chapter}:{verses.map(v => v.verse).join('-')}</span>
                            <span className="share-branding" style={{ color: textColor }}>Omni Bible</span>
                        </div>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="share-tabs">
                    <button
                        className={`tab-btn ${activeTab === 'theme' ? 'active' : ''}`}
                        onClick={() => setActiveTab('theme')}
                    >
                        {isAfrikaans ? 'Temas' : 'Themes'} 🖼️
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'style' ? 'active' : ''}`}
                        onClick={() => setActiveTab('style')}
                    >
                        {isAfrikaans ? 'Styl' : 'Style'} ✨
                    </button>
                </div>

                <div className="share-controls">
                    {activeTab === 'theme' ? (
                        <div className="animate-fade-in">
                            <div className="theme-grid">
                                {THEMES.map(theme => (
                                    <button
                                        key={theme.id}
                                        className={`theme-btn ${selectedTheme.id === theme.id ? 'active' : ''}`}
                                        style={{ background: theme.bg }}
                                        onClick={() => setSelectedTheme(theme)}
                                        title={theme.name}
                                    />
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="animate-fade-in style-controls">
                            {/* Blur Slider */}
                            <div className="control-group">
                                <label>Blur</label>
                                <input
                                    type="range" min="0" max="8" step="0.5"
                                    value={blurLevel} onChange={e => setBlurLevel(e.target.value)}
                                />
                            </div>

                            {/* Size Slider */}
                            <div className="control-group">
                                <label>Size</label>
                                <input
                                    type="range" min="0.8" max="2.2" step="0.1"
                                    value={textSize} onChange={e => setTextSize(e.target.value)}
                                />
                            </div>

                            {/* Font Toggle */}
                            <div className="control-group">
                                <label>Font</label>
                                <div className="button-group">
                                    <button className={font === 'modern' ? 'active' : ''} onClick={() => setFont('modern')}>Modern</button>
                                    <button className={font === 'classic' ? 'active' : ''} onClick={() => setFont('classic')}>Classic</button>
                                </div>
                            </div>

                            {/* Color Pickers */}
                            <div className="control-group">
                                <label>Color</label>
                                <div className="color-dots">
                                    {TEXT_COLORS.map(c => (
                                        <button
                                            key={c.name}
                                            className={`color-dot ${textColor === c.value ? 'active' : ''}`}
                                            style={{ background: c.value }}
                                            onClick={() => setTextColor(c.value)}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className="control-group">
                                <label>Outline</label>
                                <div className="color-dots">
                                    {STROKE_COLORS.map(c => (
                                        <button
                                            key={c.name}
                                            className={`color-dot stroke-dot ${strokeColor === c.value ? 'active' : ''}`}
                                            style={{ background: c.value === 'transparent' ? '#ccc' : c.value }}
                                            onClick={() => setStrokeColor(c.value)}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="share-actions-row">
                        <button
                            className="share-confirm-btn"
                            onClick={handleShare}
                            disabled={loading}
                        >
                            {loading ? 'Creating...' : (isAfrikaans ? 'Deel / Aflaai' : 'Share / Download')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ShareImageModal;
