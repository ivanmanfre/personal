/**
 * Register the service worker with vite-plugin-pwa's virtual module.
 * Called once on dashboard-v2 mount.
 */
export function registerServiceWorker() {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;

  // The virtual module is provided by vite-plugin-pwa at build time.
  import('virtual:pwa-register' as any).then(({ registerSW }) => {
    registerSW({
      immediate: true,
      onNeedRefresh() {
        // For an internal tool used by one user, auto-update on next nav.
        // Could surface a refresh prompt here if desired.
        console.log('[SW] update available, will activate on next reload');
      },
      onOfflineReady() {
        console.log('[SW] offline-ready');
      },
      onRegisteredSW(_swUrl, registration) {
        console.log('[SW] registered', registration?.scope);
      },
    });
  }).catch(err => {
    // In dev mode (devOptions.enabled = false) the virtual module isn't
    // available — silent fail so dashboard still loads.
    console.debug('[SW] register skipped:', err.message);
  });
}
