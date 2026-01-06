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
                id: '/',
                name: 'Bible Study App',
                short_name: 'Bible',
                description: 'Read and study multiple Bible versions',
                theme_color: '#1a1a2e',
                background_color: '#0f0f1e',
                display: 'standalone',
                orientation: 'portrait-primary',
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
                        src: 'icon-512.png', // Temporary: Replace with actual screenshot of your app
                        sizes: '512x512',
                        type: 'image/png',
                        form_factor: 'wide',
                        label: 'Desktop View'
                    },
                    {
                        src: 'icon-512.png', // Temporary: Replace with actual screenshot of your app
                        sizes: '512x512',
                        type: 'image/png',
                        form_factor: 'narrow',
                        label: 'Mobile View'
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
                enabled: true,
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
