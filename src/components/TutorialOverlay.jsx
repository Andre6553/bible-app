import React, { useState, useEffect } from 'react';
import './TutorialOverlay.css';

/**
 * TutorialOverlay
 * Steps format: [{ target: '#element-id', title: 'Step 1', content: 'Description...' }]
 */
const TutorialOverlay = ({ steps, onComplete, onNext, isOpen, language = 'en', externalStepIdx = null }) => {
    const [internalStepIdx, setInternalStepIdx] = useState(0);
    const currentStepIdx = externalStepIdx !== null ? externalStepIdx : internalStepIdx;
    const [highlightStyle, setHighlightStyle] = useState({});
    const isAf = language === 'af';

    useEffect(() => {
        // Reset internal state if it opens/closes
        if (!isOpen) setInternalStepIdx(0);
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && steps[currentStepIdx]) {
            // Settling delay: wait for entrance animations (like slideUp) to finish
            const timer = setTimeout(updatePosition, 350);

            window.addEventListener('resize', updatePosition);
            window.addEventListener('scroll', updatePosition);

            // MutationObserver to catch movements during layout shifts
            const observer = new MutationObserver(updatePosition);
            observer.observe(document.body, {
                attributes: true,
                childList: true,
                subtree: true
            });

            return () => {
                clearTimeout(timer);
                window.removeEventListener('resize', updatePosition);
                window.removeEventListener('scroll', updatePosition);
                observer.disconnect();
            };
        }
    }, [isOpen, currentStepIdx, steps]);

    const updatePosition = () => {
        const step = steps[currentStepIdx];
        if (!step) return;
        const element = document.querySelector(step.target);

        if (element) {
            const rect = element.getBoundingClientRect();
            setHighlightStyle({
                top: rect.top - 8,
                left: rect.left - 8,
                width: rect.width + 16,
                height: rect.height + 16,
                borderRadius: '8px',
                opacity: 1
            });
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            setHighlightStyle({ opacity: 0 });
        }
    };

    const handleNext = () => {
        if (onNext) {
            onNext(currentStepIdx);
            return;
        }

        if (currentStepIdx < steps.length - 1) {
            setInternalStepIdx(prev => prev + 1);
        } else {
            onComplete();
        }
    };

    const handleSkip = () => {
        if (onComplete) onComplete();
    };

    if (!isOpen) return null;

    const currentStep = steps[currentStepIdx];

    return (
        <div className="tutorial-overlay-root">
            {/* Dark background with spotlight hole */}
            <div className="tutorial-backdrop" />

            {/* The Spotlight highlight */}
            <div className="tutorial-highlight" style={highlightStyle} />

            {/* Instruction Card */}
            {(() => {
                const cardWidth = 300;
                const cardHeight = 220; // Estimated max height
                const margin = 20;

                let cardTop = '50%';
                let cardLeft = '50%';
                let transform = 'translate(-50%, -50%)';

                if (highlightStyle.top !== undefined) {
                    const highlightBottom = highlightStyle.top + highlightStyle.height;
                    const screenHeight = window.innerHeight;
                    const screenWidth = window.innerWidth;

                    // Decide if we should place the card ABOVE or BELOW the highlight
                    // If the highlight's bottom is in the lower 60% of the screen, place card ABOVE
                    const placeAbove = highlightBottom > screenHeight * 0.6;

                    if (placeAbove) {
                        cardTop = highlightStyle.top - cardHeight - margin;
                    } else {
                        cardTop = highlightBottom + margin;
                    }

                    // Constrain Top
                    cardTop = Math.max(margin, Math.min(cardTop, screenHeight - cardHeight - margin));

                    // Horizontal positioning
                    if (screenWidth < 600) {
                        // Center horizontally on mobile
                        cardLeft = '50%';
                        transform = 'translateX(-50%)';
                        // If top was '50%', transform would be 'translate(-50%, -50%)', but we calculated cardTop
                    } else {
                        // Align with left of highlight, but stay within screen
                        cardLeft = Math.max(margin, Math.min(highlightStyle.left, screenWidth - cardWidth - margin));
                        transform = 'none';
                    }
                }

                return (
                    <div className="tutorial-card" style={{
                        top: cardTop,
                        left: cardLeft,
                        transform: transform
                    }}>
                        <div className="tutorial-progress">
                            {currentStepIdx + 1} / {steps.length}
                        </div>
                        <h3>{currentStep.title}</h3>
                        <p>{currentStep.content}</p>

                        <div className="tutorial-footer">
                            <button className="tutorial-skip" onClick={handleSkip}>
                                {isAf ? 'Slaan oor' : 'Skip'}
                            </button>
                            <button className="tutorial-next" onClick={handleNext}>
                                {currentStepIdx === steps.length - 1
                                    ? (isAf ? 'Klaar' : 'Finish')
                                    : (isAf ? 'Volgende' : 'Next')}
                            </button>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

export default TutorialOverlay;
