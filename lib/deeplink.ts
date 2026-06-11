// Bell deeplinks look like '?section=ops&sub=skills'. The Shell tracks the
// `section` URL param and re-reads it on popstate; each section reads its own
// `sub`/`otab`. buildNavUrl rewrites exactly those nav params on a given href
// (pure — testable in node). navigateToDeeplink applies it via the same
// pushState+popstate dance Briefing's onNavigate uses.
const NAV_PARAMS = ['section', 'sub', 'otab'];

export function buildNavUrl(currentHref: string, deeplink: string): string {
  const incoming = new URLSearchParams(
    deeplink.startsWith('?') ? deeplink.slice(1) : deeplink,
  );
  const url = new URL(currentHref);
  NAV_PARAMS.forEach((k) => url.searchParams.delete(k));
  incoming.forEach((v, k) => url.searchParams.set(k, v));
  return url.toString();
}

export function navigateToDeeplink(deeplink: string): void {
  if (typeof window === 'undefined') return;
  const next = buildNavUrl(window.location.href, deeplink);
  window.history.pushState(null, '', next);
  window.dispatchEvent(new PopStateEvent('popstate'));
  // Sections read their own `sub`/`otab` only on mount. The popstate above
  // switches `section`; this event tells the Shell to remount the active panel
  // so a deeplink that targets a sub-tab (even within the current section) lands.
  window.dispatchEvent(new CustomEvent('dashboard:deeplink'));
}
