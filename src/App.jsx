import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { SettingsProvider } from './context/SettingsContext';
import ThemeHandler from './components/ThemeHandler';
import { useState, useEffect, Suspense, lazy } from 'react';
import { getVersions } from './services/bibleService';
import { Analytics } from "@vercel/analytics/react"
import ErrorBoundary from './components/ErrorBoundary';
import { initGlobalErrorListeners } from './services/loggerService';
import SplashScreen from './components/SplashScreen';
import { initGA, logPageView, setUserId } from './services/analyticsService';
import { useLocation } from 'react-router-dom';
import BackButtonHandler from './components/BackButtonHandler';
import './App.css';

// Lazy load components
const BibleReader = lazy(() => import('./components/BibleReader'));
const Search = lazy(() => import('./components/Search'));
const Stats = lazy(() => import('./components/Stats'));
const Blog = lazy(() => import('./components/Blog'));
const Study = lazy(() => import('./components/Study'));
const InductiveEditor = lazy(() => import('./components/InductiveEditor'));
const Profile = lazy(() => import('./components/Profile'));
const Admin = lazy(() => import('./components/Admin'));
const Auth = lazy(() => import('./components/Auth'));
const SermonPrep = lazy(() => import('./components/SermonPrep'));
const BottomNav = lazy(() => import('./components/BottomNav'));
const SubscriptionPage = lazy(() => import('./components/SubscriptionPage'));
const Legal = lazy(() => import('./components/Legal'));
const TriviaSection = lazy(() => import('./components/TriviaSection'));
const ReadingPlans = lazy(() => import('./components/ReadingPlans'));
const ReadingPlanDetail = lazy(() => import('./components/ReadingPlanDetail'));

function App() {
    const [currentVersion, setCurrentVersion] = useState(null);
    const [versions, setVersions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showSplash, setShowSplash] = useState(true);

    useEffect(() => {
        initGlobalErrorListeners();
        initGA();
        loadVersions();

        // High-end Splash Screen duration
        const splashTimer = setTimeout(() => {
            setShowSplash(false);
        }, 2700); // 2.7s total (2.2s visible + 0.5s fade out)

        return () => clearTimeout(splashTimer);
    }, []);

    // Analytics Route Tracker
    const AnalyticsTracker = () => {
        const location = useLocation();
        useEffect(() => {
            logPageView(location.pathname + location.search);
        }, [location]);
        return null;
    };

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
                <p>Loading Omni Bible...</p>
            </div>
        );
    }

    return (
        <SettingsProvider>
            {showSplash && <SplashScreen />}
            <ThemeHandler />
            <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <AnalyticsTracker />
                <BackButtonHandler />
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
                                        path="/plans"
                                        element={<ReadingPlans />}
                                    />
                                    <Route
                                        path="/plans/:slug"
                                        element={
                                            <ReadingPlanDetail
                                                currentVersion={currentVersion}
                                                setCurrentVersion={setCurrentVersion}
                                                versions={versions}
                                            />
                                        }
                                    />
                                    <Route
                                        path="/profile"
                                        element={<Profile />}
                                    />
                                    <Route
                                        path="/admin"
                                        element={<Admin />}
                                    />
                                    <Route
                                        path="/sermon-prep"
                                        element={<SermonPrep />}
                                    />
                                    <Route
                                        path="/auth"
                                        element={<Auth />}
                                    />
                                    <Route
                                        path="/subscription"
                                        element={<SubscriptionPage />}
                                    />
                                    <Route
                                        path="/privacy"
                                        element={<Legal type="privacy" />}
                                    />
                                    <Route
                                        path="/terms"
                                        element={<Legal type="terms" />}
                                    />
                                    <Route
                                        path="/trivia"
                                        element={<TriviaSection />}
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
