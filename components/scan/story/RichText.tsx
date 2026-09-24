import React from 'react';

const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu;
/** Merge tags a model writes instead of a name. The page's example reader is always Alex. */
const PLACEHOLDER = /(\{\{?|\[|<)\s*(first[\s_-]?name|firstname|name|recipient|prospect)\s*(\}\}?|\]|>)/gi;
export const fillNames = (text: string) => String(text || '').replace(PLACEHOLDER, 'Alex');
/** Every string in an edition, placeholders filled (older scans were saved with them). */
export function fillEdition<T>(value: T): T {
  if (typeof value === 'string') return fillNames(value) as T;
  if (Array.isArray(value)) return value.map(fillEdition) as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fillEdition(v)])) as T;
  return value;
}
/** Hashtags, emoji and em dashes never render on a sample (older editions still carry them). */
export function cleanCopy(text: string) {
  return fillNames(text).replace(/\r/g, '').split('\n')
    .map(line => line.replace(EMOJI, '').replace(/ — /g, ' - ').replace(/—/g, ', ').replace(/(\s+#[^\s#]+)+\s*$/, '').trimEnd())
    .filter(line => !(line.trim() && line.trim().split(/\s+/).every(w => w.startsWith('#'))))
    .join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

type Line = { kind: 'bullet' | 'arrow' | 'number' | 'text'; text: string };
function classify(line: string): Line {
  const t = line.trim();
  let m = t.match(/^(?:→|->|➜)\s*(.+)$/); if (m) return { kind: 'arrow', text: m[1] };
  m = t.match(/^[-•*]\s+(.+)$/); if (m) return { kind: 'bullet', text: m[1] };
  m = t.match(/^\d{1,2}[.)]\s+(.+)$/); if (m) return { kind: 'number', text: m[1] };
  return { kind: 'text', text: t };
}
/** Inline lists written on one line ("→ a → b" or "1. a 2. b") go back to one item per line. */
function splitInline(block: string) {
  if (!block.includes('\n') && (block.match(/ → /g) || []).length >= 2) return block.replace(/\s+→\s+/g, '\n→ ');
  if (!block.includes('\n') && /(^|\s)1\.\s.+\s2\.\s/.test(block)) return block.replace(/\s+(\d{1,2})\.\s/g, '\n$1. ');
  return block;
}

/** LinkedIn-style text: paragraphs, line breaks and real lists. */
export function RichText({ text, className = 'sample-body' }: { text: string; className?: string }) {
  const blocks = cleanCopy(text).split(/\n\s*\n/).filter(b => b.trim());
  return <div className={className}>{blocks.map((block, bi) => {
    const lines = splitInline(block).split('\n').filter(l => l.trim()).map(classify);
    const groups: Line[][] = [];
    for (const l of lines) {
      const g = groups[groups.length - 1];
      if (g && (g[0].kind === l.kind)) g.push(l); else groups.push([l]);
    }
    return <React.Fragment key={bi}>{groups.map((g, gi) => {
      const k = `${bi}-${gi}`;
      if (g[0].kind === 'text') return <p key={k}>{g.map((l, i) => <React.Fragment key={i}>{i > 0 && <br/>}{l.text}</React.Fragment>)}</p>;
      if (g[0].kind === 'number') return <ol key={k} className="rt-list rt-number">{g.map((l, i) => <li key={i}>{l.text}</li>)}</ol>;
      return <ul key={k} className={`rt-list rt-${g[0].kind}`}>{g.map((l, i) => <li key={i}>{l.text}</li>)}</ul>;
    })}</React.Fragment>;
  })}</div>;
}
