import React, { useState, lazy, Suspense } from 'react';

/**
 * Merged Lead Magnets section.
 *
 * "Ideas" = the upstream curator feed (LmIdeasPanel — curator-decided ideas,
 * approve flows through Editorial v2 → lm_drafts_v2).
 * "Drafts" = lm_drafts_v2 (LeadMagnetStudioPanel — generate content + assets,
 * approve & publish).
 *
 * Living together so the LM lifecycle is in one place: idea → approval → draft
 * → content → assets → live.
 */
const LmIdeasPanel = lazy(() => import('../../dashboard/LmIdeasPanel'));
const LeadMagnetStudioPanel = lazy(() => import('../../dashboard/LeadMagnetStudioPanel'));

type LmKey = 'ideas' | 'drafts';

const LABELS: Record<LmKey, string> = {
  ideas: 'Ideas',
  drafts: 'Drafts',
};

const ORDER: LmKey[] = ['ideas', 'drafts'];

function getInitialLm(): LmKey {
  if (typeof window === 'undefined') return 'ideas';
  const params = new URLSearchParams(window.location.search);
  const k = params.get('lm') as LmKey | null;
  if (k && ORDER.includes(k)) return k;
  return 'ideas';
}

function syncLmToUrl(k: LmKey) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (url.searchParams.get('lm') !== k) {
    url.searchParams.set('lm', k);
    window.history.replaceState(null, '', url.toString());
  }
}

const Loading = () => (
  <div style={{ padding: '2rem 0', color: 'var(--d-paper-dim)', fontSize: 13 }}>Loading…</div>
);

export function LeadMagnets() {
  const [k, setK] = useState<LmKey>(getInitialLm);

  const handle = (v: string) => {
    setK(v as LmKey);
    syncLmToUrl(v as LmKey);
  };

  const render = () => {
    switch (k) {
      case 'ideas':  return <LmIdeasPanel />;
      case 'drafts': return <LeadMagnetStudioPanel />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs uppercase tracking-wider text-zinc-500 mr-1">Lead Magnets</span>
        {ORDER.map((key) => (
          <button
            key={key}
            onClick={() => handle(key)}
            className={`rounded px-3 py-1.5 text-sm font-medium transition ${k === key ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
          >
            {LABELS[key]}
          </button>
        ))}
      </div>
      <Suspense fallback={<Loading />}>
        {render()}
      </Suspense>
    </div>
  );
}
