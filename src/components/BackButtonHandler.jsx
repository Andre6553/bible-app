import { useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * BackButtonHandler - Global Android back button handler
 * 
 * This component prevents the app from closing when the Android back button is pressed.
 * Instead, it navigates to /bible as a safe fallback.
 * 
 * For modals: Components should register their close handlers using the 
 * window.backButtonHandler registry.
 */

// Global registry for modal close handlers
// Components can register: window.backButtonHandlers.add(closeFunction)
// And unregister: window.backButtonHandlers.delete(closeFunction)
if (typeof window !== 'undefined' && !window.backButtonHandlers) {
    window.backButtonHandlers = new Set();
}

const BackButtonHandler = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const handleBackButton = useCallback((e) => {
        // Check if there are any registered modal close handlers
        if (window.backButtonHandlers && window.backButtonHandlers.size > 0) {
            // Get the most recently added handler (last one)
            const handlers = Array.from(window.backButtonHandlers);
            const lastHandler = handlers[handlers.length - 1];

            // Call the handler to close the modal
            if (typeof lastHandler === 'function') {
                lastHandler();
            }

            // Push state back to prevent navigation
            window.history.pushState(null, '', window.location.href);
            return;
        }

        // If we're not on /bible, navigate to /bible
        if (location.pathname !== '/bible') {
            e.preventDefault();
            navigate('/bible');
            // Push state to prevent app from closing on next back press
            window.history.pushState(null, '', window.location.href);
            return;
        }

        // If on /bible with no modals, push state to prevent app from closing
        // This creates a "dummy" history entry so back button doesn't exit
        window.history.pushState(null, '', window.location.href);
    }, [navigate, location.pathname]);

    useEffect(() => {
        // Push initial state to prevent immediate exit
        window.history.pushState(null, '', window.location.href);

        // Listen for back button (popstate event)
        window.addEventListener('popstate', handleBackButton);

        return () => {
            window.removeEventListener('popstate', handleBackButton);
        };
    }, [handleBackButton]);

    return null;
};

export default BackButtonHandler;

/**
 * Hook for components to register their close handler with the back button system
 * 
 * Usage in a modal component:
 * 
 * import { useBackButton } from './BackButtonHandler';
 * 
 * const MyModal = ({ isOpen, onClose }) => {
 *     useBackButton(isOpen, onClose);
 *     ...
 * };
 */
export const useBackButton = (isActive, closeHandler) => {
    useEffect(() => {
        if (!isActive || !closeHandler) return;

        // Register the close handler
        window.backButtonHandlers?.add(closeHandler);

        // Push state to create back button target
        window.history.pushState({ modal: true }, '', window.location.href);

        return () => {
            // Unregister when modal closes or component unmounts
            window.backButtonHandlers?.delete(closeHandler);
        };
    }, [isActive, closeHandler]);
};
