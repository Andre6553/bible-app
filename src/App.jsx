import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect, Suspense, lazy } from 'react';
import { getVersions } from './services/bibleService';
import './App.css';

// Lazy load components
const BibleReader = lazy(() => import('./components/BibleReader'));
const Search = lazy(() => import('./components/Search'));
const BottomNav = lazy(() => import('./components/BottomNav'));

function App() {
    const [currentVersion, setCurrentVersion] = useState(null);
    const [versions, setVersions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadVersions();
    }, []);

    const loadVersions = async () => {
        const result = await getVersions();
        if (result.success) {
            setVersions(result.data);
            // Set first version as default
            if (result.data.length > 0) {
                const defaultVer = result.data.find(v => v.id === 'AFR53') || result.data[0];
                setCurrentVersion(defaultVer);
            }
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
        <Router>
            <div className="app">
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
                            <Route path="/" element={<Navigate to="/bible" replace />} />
                        </Routes>
                    </Suspense>
                </div>
                <Suspense fallback={null}>
                    <BottomNav />
                </Suspense>
            </div>
        </Router>
    );
}

export default App;
