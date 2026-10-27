// Dev: `npx vite --port 5199` reads .env.local as usual (including the dev-only VITE_BOARDS view links).
// Build: env files are NOT exposed. Only the allow-list below reaches the bundle, through `define`,
// the same posture as personal-site's vite.board-host.config.ts. Everything else in import.meta.env
// stays undefined, so a board token in .env.local can never be inlined into dist/.
//   BOARD_BASE=/client/arch-agency/ npm run build      (base path, default '/')
//   VITE_BOARD_LOCKED_SLUG=swishdm-live BOARD_BASE=/board/ npm run build   (one-client host)
import path from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv, type Plugin } from 'vite';

const ALLOWED_ENV = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_BOARD_LOCKED_SLUG'] as const;
const NAMES: Record<string, string> = { 'arch-agency': 'ARCH', 'risedtc-com': 'RISE DTC', 'swishdm-live': 'SwishDM' };

export default defineConfig(({ command, mode }) => {
  if (command === 'serve') {
    const devHtml: Plugin = { name: 'board-html-dev', transformIndexHtml: h => h.replace(/%BOARD_TITLE%/g, 'Content board (dev)') };
    return { plugins: [react(), tailwindcss(), devHtml], server: { port: 5199, strictPort: true } };
  }
  // Process env wins; the local env file only fills the three allowed names, nothing else.
  const file = loadEnv(mode, process.cwd(), '');
  const val = (k: string) => process.env[k] ?? file[k] ?? '';
  for (const k of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']) if (!val(k)) throw new Error(`[board] ${k} is required for a build`);
  const locked = val('VITE_BOARD_LOCKED_SLUG');
  const html: Plugin = {
    name: 'board-html',
    transformIndexHtml: h => h.replace(/%BOARD_TITLE%/g, `${locked ? NAMES[locked] || locked : 'Client'} · content board`),
  };
  return {
    base: process.env.BOARD_BASE || '/',
    publicDir: false,
    // No env file is read into import.meta.env: a prefix nothing uses, and a folder with no env files.
    envDir: path.resolve(__dirname, 'build-env'),
    envPrefix: '__BOARD_NONE__',
    define: Object.fromEntries(ALLOWED_ENV.map(k => [`import.meta.env.${k}`, JSON.stringify(val(k))])),
    plugins: [react(), tailwindcss(), html],
    build: { outDir: 'dist', emptyOutDir: true, sourcemap: false },
  };
});
