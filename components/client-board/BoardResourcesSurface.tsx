import React from 'react';

export interface BoardResource {
  title: string;
  href: string;
  note?: string;
  status?: string;
}

export default function BoardResourcesSurface({ resources }: { resources: BoardResource[] }) {
  const links = resources.filter(item => {
    try { return ['https:', 'http:'].includes(new URL(item.href).protocol); }
    catch { return false; }
  });
  return (
    <section aria-label="Strategy and resources">
      <h1 className="mb-2 text-[28px] font-bold" style={{ color: 'var(--cb-ink)' }}>Strategy and resources</h1>
      <p className="mb-6 text-[14px]" style={{ color: 'var(--cb-ink-mute)' }}>Prepared for your review. Posts and videos are in All content.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {links.map(item => (
          <a key={item.href} href={item.href} target="_blank" rel="noopener noreferrer" className="block min-w-0 rounded-2xl border p-5" style={{ borderColor: 'var(--cb-line)', background: 'var(--cb-paper, white)', color: 'var(--cb-ink)', overflowWrap: 'anywhere' }}>
            {item.status && <span className="mb-2 block text-[12px] font-semibold" style={{ color: 'var(--cb-ink-mute)' }}>{item.status}</span>}
            <h2 className="text-[18px] font-bold">{item.title}</h2>
            {item.note && <p className="mt-2 text-[14px] leading-relaxed" style={{ color: 'var(--cb-ink-mute)' }}>{item.note}</p>}
            <span className="mt-4 inline-block text-[14px] font-semibold underline underline-offset-4">Open →</span>
          </a>
        ))}
      </div>
    </section>
  );
}
