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
            // Tiny delay to ensure DOM is ready for newly rendered steps
            const timer = setTimeout(updatePosition, 100);
            window.addEventListener('resize', updatePosition);
            window.addEventListener('scroll', updatePosition);
            return () => {
                clearTimeout(timer);
                window.removeEventListener('resize', updatePosition);
                window.removeEventListener('scroll', updatePosition);
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
            <div className="tutorial-card" style={{
                top: highlightStyle.top ? Math.min(window.innerHeight - 250, highlightStyle.top + highlightStyle.height + 20) : '50%',
                left: highlightStyle.left ? Math.min(window.innerWidth - 320, Math.max(20, highlightStyle.left)) : '50%',
                transform: highlightStyle.top ? 'none' : 'translate(-50%, -50%)'
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
        </div>
    );
};

export default TutorialOverlay;
