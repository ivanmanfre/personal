import React from 'react';

interface SourceContextDetail {
  kind?: string;
  source?: string;
  label?: string;
  source_url?: string;
  url?: string;
  supporting_urls?: string[];
  explanation?: string;
  claim_boundary?: string;
  evidence_status?: string;
  reference_only?: boolean;
  note?: string;
}

function publicLink(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined;
  } catch { return undefined; }
}

/** Review context stays outside the post preview and its editable body. */
export default function PostSourceContext({ detail, label, quote, date, compact = false }: {
  detail?: SourceContextDetail;
  label?: string | null;
  quote?: string | null;
  date?: string | null;
  compact?: boolean;
}) {
  if (detail?.kind === 'strategy') return null;
  const source = detail?.source || label || detail?.label;
  const primary = publicLink(detail?.source_url || detail?.url);
  const links = [...new Set([primary, ...(detail?.supporting_urls || []).map(publicLink)].filter(Boolean))] as string[];
  const explanation = detail?.explanation;
  const boundary = detail?.claim_boundary || detail?.note;
  if (!source && !links.length && !explanation && !quote && !boundary) return null;
  return (
    <section aria-label="Source and angle" data-post-source style={{ padding: compact ? '3px 2px 12px' : '0 0 16px', borderBottom: compact ? undefined : '1px solid var(--cb-line, #ddd)', color: 'var(--cb-ink, #131210)', fontSize: compact ? 12.5 : 13.5, lineHeight: 1.5, overflowWrap: 'anywhere' }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--cb-ink-mute, #666)' }}>
        {detail?.reference_only ? 'Source reference · adaptation pending' : 'Source'}
      </div>
      {source && <div style={{ marginTop: 3, fontWeight: 700 }}>{source}{date ? ` · ${date}` : ''}</div>}
      {links.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 4 }}>
        {links.map((href, index) => <a key={href} href={href} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color: 'inherit', textDecoration: 'underline', textUnderlineOffset: 3, display: 'inline-flex', alignItems: 'center', minHeight: 44 }}>
          {index === 0 ? 'Open original source' : 'Supporting source'}
        </a>)}
      </div>}
      {explanation && <p style={{ margin: '8px 0 0' }}><strong>Why this post: </strong>{explanation}</p>}
      {(quote || boundary) && <details style={{ marginTop: 7 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, minHeight: 44, paddingTop: 10 }}>
          {['needs_copy_revision', 'source_gap'].includes(detail?.evidence_status || '') ? 'Evidence needs attention' : 'Source notes'}
        </summary>
        {quote && <blockquote style={{ margin: '8px 0', paddingLeft: 12, borderLeft: '2px solid var(--cb-line, #ddd)' }}>{quote}</blockquote>}
        {boundary && <p style={{ margin: '8px 0 0' }}>{boundary}</p>}
      </details>}
    </section>
  );
}
