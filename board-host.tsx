// White-label board host entry (2026-10-15). One client board, served top-level on the
// client's own domain (madebyswishdm.com/board), same origin, so email sign-in, the #ml=
// link and the ?k= board link all work there. Built by vite.board-host.config.ts; the slug
// is fixed at build time (VITE_BOARD_HOST_SLUG) so this bundle can only ever open that board.
// No marketing site, dashboard, service worker or LemonSqueezy here: just the board.
import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './styles.css';
import ClientBoardPage from './components/ClientBoardPage';
import { trackPageview } from './lib/pageviewTracker';

const SLUG = import.meta.env.VITE_BOARD_HOST_SLUG as string;
const BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') || '/';

function HostedBoard() {
  // Board opens keep landing in the same pageviews path as the /client/<slug> route.
  useEffect(() => { void trackPageview(`/client/${SLUG}`); }, []);
  return <ClientBoardPage lockedSlug={SLUG} />;
}

// A lazy chunk 404s after a new board release under an open tab: reload once.
window.addEventListener('vite:preloadError', (e) => {
  e.preventDefault();
  const k = 'board-host-reloaded-at';
  const last = Number(sessionStorage.getItem(k) || 0);
  if (last && Date.now() - last < 15000) return;
  sessionStorage.setItem(k, String(Date.now()));
  window.location.reload();
});

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={BASE}>
      <Routes>
        <Route path="*" element={<HostedBoard />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
