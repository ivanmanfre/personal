import React from 'react';

interface SourceContextDetail {
  kind?: string;
  source?: string;
  label?: string;
  source_url?: string;
  url?: string;
  supporting_urls?: string[];
  references?: { url?: string; label?: string; title?: string }[];
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
  const links = [...new Set([primary, ...(detail?.supporting_urls || []).map(publicLink), ...(detail?.references || []).map(ref => publicLink(ref.url))].filter(Boolean))] as string[];
  const sourceHasDate = /\b\d{1,2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)|\b\d{4}-\d{2}-\d{2}/i.test(source || '');
  const explanation = detail?.explanation;
  const boundary = detail?.claim_boundary || detail?.note;
  if (!source && !links.length && !explanation && !quote && !boundary) return null;
  return (
    <section aria-label="Source and angle" data-post-source style={{ padding: compact ? '3px 2px 12px' : '0 0 16px', borderBottom: compact ? undefined : '1px solid var(--cb-line, #ddd)', color: 'var(--cb-ink, #131210)', fontSize: compact ? 13 : 14, lineHeight: 1.45, overflowWrap: 'anywhere' }}>
      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--cb-ink-mute, #666)' }}>
        {detail?.reference_only ? 'Source reference · adaptation pending' : 'Source'}
      </div>
      {source && <div style={{ marginTop: 3, fontWeight: 700 }}>{source}{date && !sourceHasDate ? ` · ${date}` : ''}</div>}
      {(links.length > 0 || explanation || quote || boundary) && <details style={{ marginTop: 4 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, minHeight: 44, padding: '10px 0' }}>
          {['needs_copy_revision', 'source_gap'].includes(detail?.evidence_status || '') ? 'Source notes · needs attention' : 'Source notes'}
        </summary>
        <div style={{ padding: '0 0 10px' }}>
          {explanation && <p style={{ margin: '4px 0 12px' }}><strong>Why this post: </strong>{explanation}</p>}
          {links.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
            {links.map((href) => <a key={href} href={href} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color: 'inherit', textDecoration: 'underline', textUnderlineOffset: 3, display: 'inline-flex', alignItems: 'center', minHeight: 44 }}>
              {href === primary ? 'Open original source' : (detail?.references?.find(ref => publicLink(ref.url) === href)?.title || detail?.references?.find(ref => publicLink(ref.url) === href)?.label || 'Supporting source')}
            </a>)}
          </div>}
          {quote && <blockquote style={{ margin: '12px 0', paddingLeft: 12, borderLeft: '2px solid var(--cb-line, #ddd)' }}>{quote}</blockquote>}
          {boundary && <p style={{ margin: '12px 0 0' }}>{boundary}</p>}
        </div>
      </details>}
    </section>
  );
}
