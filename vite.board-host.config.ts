// White-label board host build (2026-10-15): `BOARD_HOST=swishdm npm run build:board-host`.
//
// Builds ONLY the client board (entry board-host.html -> board-host.tsx) for one client's
// own domain, under that domain's path, locked to that client's slug. Output lands in
// dist-board-host/ as a self-contained folder (index.html + assets/) that
// scripts/publish-board-host.sh copies into the client's GitHub Pages repo.
//
// Deliberately separate from vite.config.ts so the main site build is untouched:
// - no public/ dir (Ivan's portraits, favicons, OG images never ship to a client domain)
// - no PWA / service worker, no manifest
// - no .env files: only VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY come from the process
//   env (the anon key is public by design); nothing else is ever inlined.
import path from 'path';
import fs from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// One entry per white-label host. Keep in sync with lib/boardHost.ts (WHITE_LABEL_BOARDS)
// and HOSTED in supabase/functions/board-magic-link/index.ts.
export const BOARD_HOSTS: Record<string, { slug: string; base: string; url: string; title: string; icon: string }> = {
  swishdm: {
    slug: 'swishdm-live',
    base: '/board/',
    url: 'https://madebyswishdm.com/board',
    title: 'SwishDM · content board',
    icon: 'https://swishdm.com/favicon.png',
  },
  arch: {
    slug: 'arch-agency',
    base: '/board/',
    url: 'https://madebyarch.com/board',
    title: 'ARCH · content board',
    // The ARCH. wordmark the madebyarch.com pages already use as their icon.
    icon: 'https://madebyarch.com/creator-radar/assets/arch-yellow.svg',
  },
};

const hostName = process.env.BOARD_HOST || 'swishdm';
const host = BOARD_HOSTS[hostName];
if (!host) throw new Error(`[board-host] unknown BOARD_HOST "${hostName}"`);
// scripts/build-board-app.sh builds this classic board under <host>/board/classic/ (BOARD_HOST_BASE)
// now that <host>/board/ serves board-app/. Unset = the host's own base.
const base = process.env.BOARD_HOST_BASE || host.base;
if (!/^\/[a-z0-9/-]*\/$/.test(base)) throw new Error(`[board-host] bad BOARD_HOST_BASE "${base}"`);

// Only these reach the bundle. Everything else in import.meta.env stays undefined.
const ALLOWED_ENV = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];

function hostHtml(): Plugin {
  return {
    name: 'board-host-html',
    transformIndexHtml(html) {
      return html
        .replace(/%BOARD_HOST_TITLE%/g, host.title)
        .replace(/%BOARD_HOST_ICON%/g, host.icon)
        .replace(/%BOARD_HOST_URL%/g, host.url);
    },
    // The entry is board-host.html; the host serves it as <base>/index.html.
    writeBundle(opts) {
      const dir = opts.dir || 'dist-board-host';
      const from = path.join(dir, 'board-host.html');
      if (fs.existsSync(from)) fs.renameSync(from, path.join(dir, 'index.html'));
    },
  };
}

export default defineConfig({
  base,
  publicDir: false,
  // Point env loading at a folder with no .env files; the define block below is the only
  // way a value gets in.
  envDir: path.resolve(__dirname, 'scripts/board-host-env'),
  envPrefix: '__BOARD_HOST_NONE__',
  define: {
    ...Object.fromEntries(ALLOWED_ENV.map((k) => [`import.meta.env.${k}`, JSON.stringify(process.env[k] || '')])),
    'import.meta.env.VITE_BOARD_HOST_SLUG': JSON.stringify(host.slug),
  },
  plugins: [tailwindcss(), react(), hostHtml()],
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  build: {
    // scripts/build-board-app.sh points this at <out>/classic (BOARD_HOST_OUT).
    outDir: process.env.BOARD_HOST_OUT || 'dist-board-host',
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'board-host.html'),
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-motion': ['framer-motion'],
        },
      },
    },
  },
});
