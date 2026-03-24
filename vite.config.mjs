import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import basicSsl from '@vitejs/plugin-basic-ssl'

const isElectronBuild = process.env.ELECTRON_BUILD === 'true'
const disableSsl = process.env.DISABLE_SSL === 'true'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    const forElectron = isElectronBuild || mode === 'electron'
    const skipSsl = disableSsl || forElectron

    return {
        base: forElectron ? './' : '/',
        plugins: [
            // Rewrite /mobile-app/ to /mobile-app/index.html so Vite's SPA
            // fallback doesn't serve the main app instead of the mobile PWA.
            {
                name: 'mobile-app-rewrite',
                configureServer(server) {
                    server.middlewares.use((req, res, next) => {
                        const [pathname, search] = (req.url || '').split('?');
                        if (pathname === '/mobile-app' || pathname === '/mobile-app/') {
                            req.url = '/mobile-app/index.html' + (search ? '?' + search : '');
                        }
                        next();
                    });
                }
            },
            // SSL only needed for browser dev (not Electron, not preview tool)
            ...(!skipSsl ? [basicSsl()] : []),
            react(),
            // PWA only for web builds — Electron doesn't need service workers
            ...(!forElectron ? [VitePWA({
                registerType: 'autoUpdate',
                includeAssets: ['favicon.png', 'icon-192.png', 'icon-512.png'],
                manifest: {
                    name: 'WavLoom Studio',
                    short_name: 'WavLoom',
                    description: 'Browser-based DAW with AI-powered pattern generation',
                    theme_color: '#0a0a0f',
                    background_color: '#0a0a0f',
                    display: 'standalone',
                    orientation: 'landscape',
                    start_url: '/',
                    icons: [
                        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
                        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
                        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
                    ]
                },
                workbox: {
                    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,wasm}'],
                    maximumFileSizeToCacheInBytes: 6 * 1024 * 1024, // 6MB — JS bundles are large (45 locales)
                    runtimeCaching: [
                        {
                            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                            handler: 'CacheFirst',
                            options: {
                                cacheName: 'google-fonts-stylesheets',
                                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }
                            }
                        },
                        {
                            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                            handler: 'CacheFirst',
                            options: {
                                cacheName: 'google-fonts-webfonts',
                                expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }
                            }
                        },
                        {
                            urlPattern: /^https:\/\/accounts\.google\.com\/.*/i,
                            handler: 'NetworkOnly'
                        },
                        {
                            urlPattern: /^wss?:\/\/.*\.peerjs\.com\/.*/i,
                            handler: 'NetworkOnly'
                        }
                    ]
                }
            })] : [])
        ],
        server: {
            host: '0.0.0.0',
            port: 5173,
            strictPort: false,
            hmr: false  // Disable HMR for proxied access
        },
        test: {
            environment: 'node'
        },
        build: {
            chunkSizeWarningLimit: 1000
        }
    }
})
