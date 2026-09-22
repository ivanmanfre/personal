import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Standalone build of the scan walkthrough preview (relative asset paths, no PWA, no router).
export default defineConfig({
  base: './',
  root: path.resolve(__dirname, 'preview'),
  publicDir: false,
  envDir: path.resolve(__dirname),
  plugins: [react()],
  build: { outDir: path.resolve(__dirname, 'dist-preview'), emptyOutDir: true },
});
