import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { searchVerses, getVerseReference } from '../services/bibleService';
import './Search.css';

function Search({ currentVersion, versions }) {
    const [searchParams, setSearchParams] = useSearchParams();
    const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
    const [searchVersion, setSearchVersion] = useState(searchParams.get('version') || 'all');
    const [searchTestament, setSearchTestament] = useState(searchParams.get('testament') || 'all');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    // Auto-search on mount if params exist
    useEffect(() => {
        const query = searchParams.get('q');
        const ver = searchParams.get('version');
        const test = searchParams.get('testament');

        if (query) {
            setSearchQuery(query);
            if (ver) setSearchVersion(ver);
            if (test) setSearchTestament(test);
            performSearch(query, ver || 'all', test || 'all');
        }
    }, [searchParams]);

    const performSearch = async (query, versionId, testament) => {
        if (!query.trim()) return;

        setLoading(true);
        setHasSearched(true);

        const result = await searchVerses(query.trim(), versionId, testament);

        if (result.success) {
            setResults(result.data);
        } else {
            setResults([]);
        }

        setLoading(false);
    };

    const handleSearch = (e) => {
        e.preventDefault();
        // Update URL
        setSearchParams({ q: searchQuery, version: searchVersion, testament: searchTestament });
        // Search triggered by useEffect on param change OR we can call directly if we want instant
        // But updating params -> useEffect is cleaner for keeping sync
    };

    const highlightText = (text, query) => {
        if (!query) return text;

        const parts = text.split(new RegExp(`(${query})`, 'gi'));
        return parts.map((part, index) =>
            part.toLowerCase() === query.toLowerCase() ?
                <mark key={index} className="highlight">{part}</mark> :
                part
        );
    };

    const handleFilterChange = (key, value) => {
        // Update local state is not strictly necessary if we depend on URL but keeps UI snappy
        if (key === 'version') setSearchVersion(value);
        if (key === 'testament') setSearchTestament(value);

        // Update URL to trigger search
        const newParams = { q: searchQuery, version: searchVersion, testament: searchTestament };
        newParams[key] = value; // Override with new value
        setSearchParams(newParams);
    };

    return (
        <div className="search-page">
            <div className="search-header">
                <h1 className="search-title">Search the Bible</h1>

                <form onSubmit={handleSearch} className="search-form">
                    <div className="search-input-wrapper">
                        <input
                            type="text"
                            className="search-input input"
                            placeholder="Search for verses, keywords, or topics..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <button
                            type="submit"
                            className="search-btn btn-primary"
                            disabled={loading || !searchQuery.trim()}
                        >
                            {loading ? '...' : '🔍'}
                        </button>
                    </div>

                    <div className="search-filters">
                        <label className="filter-label">
                            <span>Version:</span>
                            <select
                                className="version-filter select"
                                value={searchVersion}
                                onChange={(e) => handleFilterChange('version', e.target.value)}
                            >
                                <option value="all">All Versions</option>
                                {versions.map(version => (
                                    <option key={version.id} value={version.id}>
                                        {version.abbreviation} - {version.name}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="filter-label">
                            <span>Testament:</span>
                            <select
                                className="version-filter select"
                                value={searchTestament}
                                onChange={(e) => handleFilterChange('testament', e.target.value)}
                            >
                                <option value="all">Both Testaments</option>
                                <option value="OT">Old Testament</option>
                                <option value="NT">New Testament</option>
                            </select>
                        </label>
                    </div>
                </form>
            </div>

            <div className="search-results">
                {loading ? (
                    <div className="loading-state">
                        <div className="loading-spinner"></div>
                        <p>Searching...</p>
                    </div>
                ) : hasSearched ? (
                    results.length > 0 ? (
                        <>
                            <div className="results-header">
                                <p className="results-count">
                                    Found {results.length} verse{results.length !== 1 ? 's' : ''}
                                </p>
                            </div>

                            <div className="results-list">
                                {results.map(verse => (
                                    <div key={verse.id} className="result-card card">
                                        <div className="result-header">
                                            <span className="result-reference">
                                                {getVerseReference(verse)}
                                            </span>
                                            <span className="result-version">
                                                {verse.version}
                                            </span>
                                        </div>
                                        <p className="result-text">
                                            {highlightText(verse.text, searchQuery)}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            {results.length >= 1000 && (
                                <p className="results-notice">
                                    Showing first 1000 results. Try a more specific search if you can't find what you're looking for.
                                </p>
                            )}
                        </>
                    ) : (
                        <div className="empty-state">
                            <div className="empty-icon">📖</div>
                            <h3>No verses found</h3>
                            <p>Try different keywords or check your spelling</p>
                        </div>
                    )
                ) : (
                    <div className="empty-state">
                        <div className="empty-icon">🔍</div>
                        <h3>Search the Scriptures</h3>
                        <p>Enter keywords, phrases, or topics to find verses</p>
                        <div className="search-tips">
                            <h4>Search Tips:</h4>
                            <ul>
                                <li>Try single words like "love" or "faith"</li>
                                <li>Use phrases like "the Lord is my shepherd"</li>
                                <li>Search for specific topics like "forgiveness"</li>
                            </ul>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Search;
