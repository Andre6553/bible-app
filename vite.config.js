import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['bible-icon.svg', 'icon-192.png', 'icon-512.png'],
            manifest: {
                id: 'com.omnibible.online',
                name: 'Omni Bible',
                short_name: 'Omni Bible',
                description: 'AI-Powered Bible Study Application',
                theme_color: '#1a1a2e',
                background_color: '#050510',
                display: 'standalone',
                scope: '/',
                start_url: '/',
                orientation: 'portrait',
                categories: ['books', 'education', 'lifestyle'],
                icons: [
                    {
                        src: 'icon-192.png',
                        sizes: '192x192',
                        type: 'image/png',
                        purpose: 'any maskable'
                    },
                    {
                        src: 'icon-512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any maskable'
                    }
                ],
                screenshots: [
                    {
                        src: 'screenshots/processed_1.png',
                        sizes: '1920x1080',
                        type: 'image/png',
                        form_factor: 'wide',
                        label: 'Dashboard'
                    },
                    {
                        src: 'screenshots/processed_2.png',
                        sizes: '1920x1080',
                        type: 'image/png',
                        form_factor: 'wide',
                        label: 'Sermon Manager'
                    },
                    {
                        src: 'screenshots/processed_3.png',
                        sizes: '1920x1080',
                        type: 'image/png',
                        form_factor: 'wide',
                        label: 'Editor'
                    },
                    {
                        src: 'screenshots/processed_4.png',
                        sizes: '1920x1080',
                        type: 'image/png',
                        form_factor: 'wide',
                        label: 'Studio'
                    }
                ]
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
                skipWaiting: true,
                clientsClaim: true,
                cleanupOutdatedCaches: true,
                runtimeCaching: [
                    {
                        urlPattern: /^https:\/\/fikjnvkzhemamtlwsrin\.supabase\.co\/.*/i,
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'bible-api-cache-v12-2', // Bumped to force update for v12.2 logic
                            expiration: {
                                maxEntries: 100,
                                maxAgeSeconds: 60 * 60 * 24 // 24 hours
                            },
                            cacheableResponse: {
                                statuses: [0, 200]
                            }
                        }
                    }
                ]
            },
            devOptions: {
                enabled: false, // Disable PWA in dev to prevent caching issues/popups
                type: 'module',
                navigateFallback: 'index.html',
            }
        })
    ],
    server: {
        port: 3005, // Moved to 3005 to avoid port 3000 conflicts
        open: true,
        host: true,
        hmr: {
            overlay: false, // Prevent error screen from blocking the app
        },
        proxy: {
            '/tts-proxy': {
                target: 'https://translate.google.com',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/tts-proxy/, ''),
                headers: {
                    'Referer': 'https://translate.google.com/',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            }
        }
    }
});
