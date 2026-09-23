import path from 'path';
import fs from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const localEnv=loadEnv('development',process.cwd(),'');
const reviewConfigPath=process.env.SCAN_REVIEW_CONFIG||localEnv.SCAN_REVIEW_CONFIG;
const reviewKey=reviewConfigPath?JSON.parse(fs.readFileSync(reviewConfigPath,'utf8')).API_KEY:undefined;

export default defineConfig({
  // VITE_BASE=/scan/ builds the scan mirror served at inboundonsteroids.com/scan/
  // (see scripts/prerender.mjs SCAN_MIRROR + deploy.yml scan-mirror job).
  base: process.env.VITE_BASE || '/',
  server: {
    port: 3000,
    host: reviewKey ? '127.0.0.1' : '0.0.0.0',
    proxy: reviewKey ? {'/scan-stories': {target:'http://127.0.0.1:4318',headers:{'X-API-Key':reviewKey},configure(proxy){proxy.on('proxyReq',(proxyReq,req)=>{const origin=req.headers.origin;const host=req.headers.host;if(origin && origin!==`http://${host}`){proxyReq.removeHeader('X-API-Key');}})}}} : undefined,
  },
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      // injectManifest mode lets us own the SW (push handler lives there).
      strategies: 'injectManifest',
      srcDir: 'public',
      filename: 'sw.js',
      injectRegister: false, // we register manually inside the app
      registerType: 'autoUpdate',
      manifest: {
        name: 'InboundOnSteroids',
        short_name: 'InboundOnSteroids',
        description: 'Control board for the InboundOnSteroids content + automation system',
        theme_color: '#111114',
        background_color: '#111114',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/dashboard',
        start_url: '/dashboard',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      injectManifest: {
        // network-first for Supabase REST so notifications reflect fresh data
        // (we do this in the SW handler too, but keep precaching minimal here).
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      devOptions: {
        enabled: false, // dev mode skips SW; enable manually if testing push
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-recharts': ['recharts'],
          'vendor-motion': ['framer-motion'],
          'vendor-xyflow': ['@xyflow/react', '@dagrejs/dagre'],
        },
      },
    },
  },
});
