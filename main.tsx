import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './styles.css';
import App from './App';

// ── Stale-deploy self-heal ────────────────────────────────────────────────────
// The dashboard registers a service worker at scope '/', so a returning browser can
// keep running an old precached app on ANY route (incl. /scan/*) after a deploy —
// prospects' fresh browsers are unaffected, but Ivan's own browser saw "Report not
// available" twice. Three guards, all no-ops for uncontrolled (cold) visitors:
const RELOAD_GUARD = 'sw-heal-reloaded';
function healReload() {
  if (sessionStorage.getItem(RELOAD_GUARD)) return; // never loop
  sessionStorage.setItem(RELOAD_GUARD, '1');
  window.location.reload();
}
// 1. A lazy chunk 404s (deploy replaced hashed files under a live tab) → one reload.
window.addEventListener('vite:preloadError', (e) => { e.preventDefault(); healReload(); });
if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
  // 2. This page is controlled by a (possibly stale) SW → nudge an update check now.
  navigator.serviceWorker.getRegistration().then((r) => r?.update()).catch(() => {});
  // 3. When the fresh SW takes control, reload once so the new app renders.
  navigator.serviceWorker.addEventListener('controllerchange', healReload);
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
