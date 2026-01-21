import React from 'react';
import { logError } from '../services/loggerService';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        const errorMsg = error?.message || String(error);
        const isChunkError =
            errorMsg.includes('Failed to fetch dynamically imported module') ||
            errorMsg.includes('text/html is not a valid JavaScript MIME type') ||
            errorMsg.includes('Importing a module script failed');

        if (isChunkError) {
            console.warn('[ErrorBoundary] Chunk error detected. Attempting auto-recovery...');
            const lastReload = sessionStorage.getItem('last_chunk_reload');
            const now = Date.now();

            if (!lastReload || now - parseInt(lastReload) > 20000) {
                sessionStorage.setItem('last_chunk_reload', now.toString());
                window.location.reload();
                return; // Stop here, app is reloading
            }
        }

        // Log to our new service for non-chunk errors
        logError(error, {
            componentStack: errorInfo.componentStack,
            metadata: { type: 'react_boundary' }
        });
    }

    handleReload = () => {
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100vh',
                    padding: '20px',
                    background: '#0f0f1a',
                    color: '#fff',
                    textAlign: 'center'
                }}>
                    <h2 style={{ marginBottom: '10px' }}>Something went wrong.</h2>
                    <p style={{ color: '#a1a1aa', marginBottom: '20px' }}>
                        We've noted this error and will fix it shortly.
                    </p>
                    <button
                        onClick={this.handleReload}
                        style={{
                            padding: '10px 20px',
                            background: '#6366f1',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '1rem'
                        }}
                    >
                        Reload App
                    </button>
                    {/* Optional: clear local storage button if stuck? */}
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
