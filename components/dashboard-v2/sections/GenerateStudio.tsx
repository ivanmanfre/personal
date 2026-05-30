import React, { useState, lazy, Suspense } from 'react';

/**
 * Nested generation tabs — keeps Posts / Carousels / Lead Magnets
 * grouped under a single "Generate" sub-tab of Content Studio so the
 * top-level sub-nav stays focused on the major workflows.
 */
const PostStudioPanel = lazy(() => import('../../dashboard/PostStudioPanel'));
const CarouselStudioPanel = lazy(() => import('../../dashboard/CarouselStudioPanel'));

type GenKey = 'posts' | 'carousel';

const LABELS: Record<GenKey, string> = {
  posts: 'Posts',
  carousel: 'Carousels',
};

const ORDER: GenKey[] = ['posts', 'carousel'];

function getInitialGen(): GenKey {
  if (typeof window === 'undefined') return 'posts';
  const params = new URLSearchParams(window.location.search);
  const g = params.get('gen') as GenKey | null;
  if (g && ORDER.includes(g)) return g;
  return 'posts';
}

function syncGenToUrl(g: GenKey) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (url.searchParams.get('gen') !== g) {
    url.searchParams.set('gen', g);
    window.history.replaceState(null, '', url.toString());
  }
}

const Loading = () => (
  <div style={{ padding: '2rem 0', color: 'var(--d-paper-dim)', fontSize: 13 }}>Loading…</div>
);

export function GenerateStudio() {
  const [gen, setGen] = useState<GenKey>(getInitialGen);

  const handle = (g: string) => {
    setGen(g as GenKey);
    syncGenToUrl(g as GenKey);
  };

  const render = () => {
    switch (gen) {
      case 'posts':    return <PostStudioPanel />;
      case 'carousel': return <CarouselStudioPanel />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs uppercase tracking-wider text-zinc-500 mr-1">Generate</span>
        {ORDER.map((key) => (
          <button
            key={key}
            onClick={() => handle(key)}
            className={`rounded px-3 py-1.5 text-sm font-medium transition ${gen === key ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
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
