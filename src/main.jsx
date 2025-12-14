import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Unregister Service Worker to clear stale cache
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
        for (let registration of registrations) {
            registration.unregister();
            console.log('Service Worker unregistered to clear cache');
        }
    });
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
