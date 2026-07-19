import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

/**
 * Cross-section navigation, v2-native. The v1 panels used
 * useDashboard().navigateToTab, but in the v2 DemoShell cross-section nav rides
 * the URL `?section=` param + a synthetic popstate (see DemoShell.handleNavRef /
 * Today.onNavigate). navigateToTab's tabNavRef is never wired in v2, so we drive
 * the same URL mechanism directly. Maps the legacy Tab names the strategy
 * sections reference onto the live v2 section ids.
 */
const TAB_TO_SECTION: Record<string, string> = {
  outreach: 'outreach',
  workflows: 'health',
  content: 'posts',
  audience: 'scans',
  clients: 'risedtc',
};

/**
 * Strip dashes the BB v4 register forbids from authored copy: em dash ` — `
 * becomes `, `, and any stray em/en dash (incl. numeric-range en dashes) becomes
 * a plain hyphen ("ranges use a plain hyphen or 'to'"). Applied to config-authored
 * strings only; live DB text (LM titles, apollo filters) is shown verbatim.
 */
export function clean(s: string | null | undefined): string {
  return (s || '').replace(/\s+—\s+/g, ', ').replace(/[—–]/g, '-');
}

export function navigateToSection(tabOrSection: string) {
  if (typeof window === 'undefined') return;
  const section = TAB_TO_SECTION[tabOrSection] || tabOrSection;
  const url = new URL(window.location.href);
  url.searchParams.set('section', section);
  url.searchParams.delete('sub');
  window.history.pushState(null, '', url.toString());
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/** Ruled, collapsible sub-block. Replaces the v1 rounded SubCard. */
export const SubCard: React.FC<{
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ title, defaultOpen = true, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="pos-sub">
      <button
        type="button"
        className="pos-sub-btn"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="pos-sub-tw">{title}</span>
        <span className="pos-sub-chev">
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>
      </button>
      {open && <div className="pos-sub-body">{children}</div>}
    </div>
  );
};

/**
 * Lifecycle status cue — 5 states differentiated by GLYPH SHAPE and weight,
 * never by 5 hues and never all-grey (ledger §4 constraint). live/scheduled/
 * review read ink; draft/planned read muted; sold-out is the one danger red.
 */
const CUE_KNOWN = new Set(['live', 'published', 'scheduled', 'review', 'draft', 'planned', 'sold-out']);
export const StatusCue: React.FC<{ status: string }> = ({ status }) => {
  const s = (status || '').toLowerCase();
  // published renders as live (both = shipped/on-feed).
  const key =
    s === 'published' ? 'live'
    : s === 'sold-out' ? 'soldout'
    : CUE_KNOWN.has(s) ? s
    : 'draft';
  const label = s === 'published' ? 'live' : s || 'unknown';
  return (
    <span className={`pos-cue pos-cue--${key}`}>
      <span className="pos-cue-mark" aria-hidden="true" />
      {label}
    </span>
  );
};
