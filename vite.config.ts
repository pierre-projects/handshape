import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

// The app lives in app/, content in content/. BASE_PATH lets the GitHub Pages
// build serve from /<repo>/ while local dev serves from /.
export default defineConfig({
  root: 'app',
  base: process.env.BASE_PATH || '/',
  publicDir: 'public',
  build: { outDir: '../dist', emptyOutDir: true },
  server: { fs: { allow: ['..'] } },
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'ASL Practice',
        short_name: 'ASL',
        description: 'Learn American Sign Language in your browser. Nothing leaves your device.',
        theme_color: '#1f4e5f',
        background_color: '#f7f5f0',
        display: 'standalone',
        start_url: '.',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp,jpg,jpeg,gif,mp4,webm}'],
        maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
      },
    }),
  ],
});
