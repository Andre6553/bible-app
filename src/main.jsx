import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// CRITICAL FIX: Force unregister potential zombie Service Workers in Development
if (process.env.NODE_ENV === 'development') {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(function (registrations) {
            for (let registration of registrations) {
                console.log('DOM: Unregistering Zombie Service Worker:', registration);
                registration.unregister();
            }
        });
    }
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
