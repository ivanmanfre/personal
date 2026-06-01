import React, { useState, lazy, Suspense } from 'react';

/**
 * Posts section — mirrors the Lead Magnets section structure for view parity.
 *
 * "Ideas" = the curator feed filtered to content_type='post' (shared IdeasPanel).
 * "Drafts" = carousel_drafts (PostStudioPanel — text/single-image/carousel).
 *
 * Same two-tab shape as LeadMagnets (Ideas → Drafts) so both content surfaces
 * behave identically.
 */
const LmIdeasPanel = lazy(() => import('../../dashboard/LmIdeasPanel'));
const PostStudioPanel = lazy(() => import('../../dashboard/PostStudioPanel'));

type PKey = 'ideas' | 'drafts';

const LABELS: Record<PKey, string> = {
  ideas: 'Ideas',
  drafts: 'Drafts',
};

const ORDER: PKey[] = ['ideas', 'drafts'];

function getInitial(): PKey {
  if (typeof window === 'undefined') return 'drafts';
  const params = new URLSearchParams(window.location.search);
  const k = params.get('p') as PKey | null;
  if (k && ORDER.includes(k)) return k;
  return 'drafts';
}

function syncToUrl(k: PKey) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (url.searchParams.get('p') !== k) {
    url.searchParams.set('p', k);
    window.history.replaceState(null, '', url.toString());
  }
}

const Loading = () => (
  <div style={{ padding: '2rem 0', color: 'var(--d-paper-dim)', fontSize: 13 }}>Loading…</div>
);

export function Posts() {
  const [k, setK] = useState<PKey>(getInitial);

  const handle = (v: string) => {
    setK(v as PKey);
    syncToUrl(v as PKey);
  };

  const render = () => {
    switch (k) {
      case 'ideas':  return <LmIdeasPanel contentType="post" />;
      case 'drafts': return <PostStudioPanel />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs uppercase tracking-wider text-zinc-500 mr-1">Posts</span>
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
