import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [
		preact(),
		VitePWA({
			registerType: 'autoUpdate',
			includeAssets: ['icon.svg', 'apple-touch-icon.png'],
			manifest: {
				name: 'Site Survey Gen',
				short_name: 'SiteSurvey',
				description: 'Site Survey Generator',
				theme_color: '#228be6',
				background_color: '#ffffff',
				display: 'standalone',
				scope: '/',
				start_url: '/',
				icons: [
					{
						src: 'pwa-192x192.png',
						sizes: '192x192',
						type: 'image/png',
					},
					{
						src: 'pwa-512x512.png',
						sizes: '512x512',
						type: 'image/png',
					},
					{
						src: 'pwa-512x512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'any maskable',
					},
				],
			},
		workbox: {
			maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3 MB
			globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,json}'],
				// Don't cache Firebase API calls
				navigateFallback: 'index.html',
				runtimeCaching: [
					{
						urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
						handler: 'NetworkOnly',
					},
				{
					urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
					handler: 'CacheFirst',
					options: {
						cacheName: 'firebase-storage-images',
						expiration: {
							maxEntries: 200,
							maxAgeSeconds: 30 * 24 * 60 * 60,
						},
						cacheableResponse: {
							statuses: [0, 200],
						},
					},
				},
					{
						urlPattern: /^https:\/\/identitytoolkit\.googleapis\.com\/.*/i,
						handler: 'NetworkOnly',
					},
				],
			},
		}),
	],
});
