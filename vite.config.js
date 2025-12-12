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
                        type: 'image/png'
                    },
                    {
                        src: 'icon-512.png',
                        sizes: '512x512',
                        type: 'image/png'
                    }
                ]
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
                runtimeCaching: [
                    {
                        urlPattern: /^https:\/\/fikjnvkzhemamtlwsrin\.supabase\.co\/.*/i,
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'bible-api-cache',
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
            }
        })
    ],
    server: {
        port: 3005, // Moved to 3005 to avoid port 3000 conflicts
        open: true,
        host: true,
        hmr: {
            overlay: false, // Prevent error screen from blocking the app
        }
    }
});
