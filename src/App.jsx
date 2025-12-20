import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { SettingsProvider } from './context/SettingsContext';
import ThemeHandler from './components/ThemeHandler';
import { useState, useEffect, Suspense, lazy } from 'react';
import { getVersions } from './services/bibleService';
import { Analytics } from "@vercel/analytics/react"
import ErrorBoundary from './components/ErrorBoundary';
import { initGlobalErrorListeners } from './services/loggerService';
import './App.css';

// Lazy load components
const BibleReader = lazy(() => import('./components/BibleReader'));
const Search = lazy(() => import('./components/Search'));
const Stats = lazy(() => import('./components/Stats'));
const Blog = lazy(() => import('./components/Blog'));
const Study = lazy(() => import('./components/Study'));
const InductiveEditor = lazy(() => import('./components/InductiveEditor'));
const Profile = lazy(() => import('./components/Profile'));
const BottomNav = lazy(() => import('./components/BottomNav'));

function App() {
    const [currentVersion, setCurrentVersion] = useState(null);
    const [versions, setVersions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        initGlobalErrorListeners();
        loadVersions();
    }, []);

    const loadVersions = async () => {
        const result = await getVersions();
        if (result.success) {
            setVersions(result.data);

            // Check localStorage for last used version
            const savedVersionId = localStorage.getItem('lastBibleVersion');
            let selectedVersion = null;

            if (savedVersionId) {
                // Try to find the saved version
                selectedVersion = result.data.find(v => v.id === savedVersionId);
            }

            // Fallback to KJV if saved version not found, then first available
            if (!selectedVersion) {
                selectedVersion = result.data.find(v => v.id === 'KJV') || result.data[0];
            }

            setCurrentVersion(selectedVersion);
        }
        setLoading(false);
    };

    if (loading) {
        return (
            <div className="app-loading">
                <div className="loading-spinner"></div>
                <p>Loading Bible...</p>
            </div>
        );
    }

    return (
        <SettingsProvider>
            <ThemeHandler />
            <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <div className="app">
                    <Analytics />
                    <ErrorBoundary>
                        <div className="app-content">
                            <Suspense fallback={
                                <div className="loading-state">
                                    <div className="loading-spinner"></div>
                                </div>
                            }>
                                <Routes>
                                    <Route
                                        path="/bible"
                                        element={
                                            <BibleReader
                                                currentVersion={currentVersion}
                                                setCurrentVersion={setCurrentVersion}
                                                versions={versions}
                                            />
                                        }
                                    />
                                    <Route
                                        path="/search"
                                        element={
                                            <Search
                                                currentVersion={currentVersion}
                                                versions={versions}
                                            />
                                        }
                                    />
                                    <Route
                                        path="/stats"
                                        element={<Stats />}
                                    />
                                    <Route
                                        path="/blog"
                                        element={<Blog />}
                                    />
                                    <Route
                                        path="/study"
                                        element={<Study />}
                                    />
                                    <Route
                                        path="/study/:id"
                                        element={<InductiveEditor />}
                                    />
                                    <Route
                                        path="/profile"
                                        element={<Profile />}
                                    />
                                    <Route path="/" element={<Navigate to="/bible" replace />} />
                                </Routes>
                            </Suspense>
                        </div>
                        <Suspense fallback={null}>
                            <BottomNav />
                        </Suspense>
                    </ErrorBoundary>
                </div>

            </Router>
        </SettingsProvider >
    );
}

export default App;
