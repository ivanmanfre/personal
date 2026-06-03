import React from 'react';

// Lightweight markdown renderer for QA/Editorial agent bodies and source
// briefings. Supports: h1/h2/h3, **bold**/__bold__, *italic*, `code`,
// [text](url) links, blockquotes (>), bullet lists (-/*/+), numbered lists
// (1.), paragraph breaks on blank lines, separator lines (━━━), and
// "Label: value" detection for ClickUp-style metadata lines.

function renderInline(s: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < s.length) {
    // Code spans first — their content is opaque
    if (s[i] === '`') {
      const end = s.indexOf('`', i + 1);
      if (end !== -1) {
        parts.push(<code key={key++} className="px-1 py-0.5 rounded bg-zinc-800/80 text-emerald-300 text-[11.5px] font-mono">{s.slice(i + 1, end)}</code>);
        i = end + 1;
        continue;
      }
    }
    // Inline links: [text](url)
    if (s[i] === '[') {
      const close = s.indexOf(']', i + 1);
      if (close !== -1 && s[close + 1] === '(') {
        const urlEnd = s.indexOf(')', close + 2);
        if (urlEnd !== -1) {
          const label = s.slice(i + 1, close);
          const url = s.slice(close + 2, urlEnd);
          parts.push(
            <a key={key++} href={url} target="_blank" rel="noreferrer" className="text-emerald-400 underline decoration-emerald-500/30 underline-offset-2 hover:text-emerald-300 hover:decoration-emerald-400/60">
              {renderInline(label)}
            </a>
          );
          i = urlEnd + 1;
          continue;
        }
      }
    }
    // Strikethrough ~~text~~
    if (s.startsWith('~~', i)) {
      const end = s.indexOf('~~', i + 2);
      if (end !== -1) {
        parts.push(<span key={key++} className="line-through text-zinc-500">{s.slice(i + 2, end)}</span>);
        i = end + 2;
        continue;
      }
    }
    // Bold: ** or __
    if (s.startsWith('**', i)) {
      const end = s.indexOf('**', i + 2);
      if (end !== -1) {
        parts.push(<strong key={key++} className="text-zinc-100 font-semibold">{renderInline(s.slice(i + 2, end))}</strong>);
        i = end + 2;
        continue;
      }
    }
    if (s.startsWith('__', i)) {
      const end = s.indexOf('__', i + 2);
      if (end !== -1) {
        parts.push(<strong key={key++} className="text-zinc-100 font-semibold">{renderInline(s.slice(i + 2, end))}</strong>);
        i = end + 2;
        continue;
      }
    }
    // Italic: *text* (single asterisk) or _text_ (single underscore)
    if (s[i] === '*' && s[i + 1] !== '*' && s[i + 1] !== ' ' && s[i + 1]) {
      const end = s.indexOf('*', i + 1);
      if (end !== -1 && end !== i + 1) {
        parts.push(<em key={key++} className="italic text-zinc-200">{s.slice(i + 1, end)}</em>);
        i = end + 1;
        continue;
      }
    }
    // Accumulate plain text up to next special token
    const nextSpecial = (() => {
      for (let j = i; j < s.length; j++) {
        const c = s[j];
        if (c === '`' || c === '*' || c === '[' || c === '~' || c === '_') return j;
      }
      return s.length;
    })();
    parts.push(s.slice(i, nextSpecial === i ? i + 1 : nextSpecial));
    i = nextSpecial === i ? i + 1 : nextSpecial;
  }
  return parts;
}

const META_LABEL_RE = /^(Status|Verdict|Score|Confidence|Source|Agent|Category|Pillar|Hook|Tier|Topic|Style|Format|Briefing|Angle|Audience|Reasoning|Issues|Suggestions|Rewrite|Notes|Reactions|Comments|Shares|Saves|Impressions)\s*[:|—-]\s*(.*)$/i;

/** When an agent body is raw JSON (or starts with one), render it as a
 *  structured key-value list rather than dumping the JSON string. */
function tryRenderJson(s: string): React.ReactNode | null {
  const trimmed = s.trim();
  if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) return null;
  let parsed: any;
  try { parsed = JSON.parse(trimmed); } catch { return null; }
  if (Array.isArray(parsed)) {
    return (
      <ul className="list-disc list-outside pl-5 my-1 space-y-0.5 text-[12px] text-zinc-300 leading-snug">
        {parsed.slice(0, 50).map((it, i) => (
          <li key={i}>{typeof it === 'object' ? <pre className="inline whitespace-pre-wrap text-[11.5px]">{JSON.stringify(it)}</pre> : String(it)}</li>
        ))}
      </ul>
    );
  }
  return (
    <div className="space-y-0.5 text-[12px] leading-snug">
      {Object.entries(parsed).map(([k, v]) => (
        <div key={k} className="flex gap-2">
          <span className="text-emerald-300 font-semibold tabular-nums whitespace-nowrap">{k}:</span>
          <span className="text-zinc-300 min-w-0">
            {v == null ? <span className="text-zinc-600 italic">null</span>
              : typeof v === 'object'
                ? <pre className="whitespace-pre-wrap text-[11.5px] font-mono bg-zinc-900/60 rounded px-1.5 py-0.5 inline-block">{JSON.stringify(v, null, 2).slice(0, 1500)}</pre>
                : typeof v === 'boolean'
                  ? <span className={v ? 'text-emerald-300' : 'text-red-300'}>{String(v)}</span>
                  : typeof v === 'number'
                    ? <span className="tabular-nums text-zinc-200">{v}</span>
                    : String(v)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function renderLightMarkdown(md: string, opts?: { textClass?: string; editorial?: boolean }): React.ReactNode {
  if (!md) return null;
  const json = tryRenderJson(md);
  if (json) return json;
  // `editorial: true` switches to softer typography for description / briefing
  // contexts (sentence-case sage headings, larger body, mixed-case headings).
  // Default: agent-log compact mode (uppercase tracking, smaller body).
  const editorial = !!opts?.editorial;
  const textClass = opts?.textClass || (editorial ? 'text-[13.5px] text-zinc-200 leading-relaxed' : 'text-[12.5px] text-zinc-300 leading-snug');
  const h1Class = editorial
    ? 'text-[16px] font-semibold text-zinc-100 mt-4 mb-1.5'
    : 'text-[12px] uppercase tracking-wider text-emerald-400/80 font-semibold mt-3 mb-1';
  const h2Class = editorial
    ? 'text-[14px] font-semibold text-zinc-100 mt-3.5 mb-1'
    : 'text-[11px] uppercase tracking-wider text-emerald-400/70 font-semibold mt-3 mb-1';
  const h3Class = editorial
    ? 'text-[13px] font-semibold text-emerald-300/90 mt-3 mb-1'
    : 'text-[11px] tracking-wide text-emerald-300/80 font-semibold mt-2.5 mb-0.5';
  const lines = md.split('\n');
  const out: React.ReactNode[] = [];
  let key = 0;
  let listBuffer: { ordered: boolean; items: string[] } | null = null;
  let quoteBuffer: string[] | null = null;
  const flushList = () => {
    if (listBuffer && listBuffer.items.length) {
      const ListTag = listBuffer.ordered ? 'ol' : 'ul';
      const cls = listBuffer.ordered
        ? `list-decimal list-outside pl-5 my-2 space-y-1 ${textClass}`
        : `list-disc list-outside pl-5 my-2 space-y-1 marker:text-emerald-500/60 ${textClass}`;
      out.push(
        <ListTag key={key++} className={cls}>
          {listBuffer.items.map((l, i) => <li key={i} className="pl-1">{renderInline(l)}</li>)}
        </ListTag>,
      );
    }
    listBuffer = null;
  };
  const flushQuote = () => {
    if (quoteBuffer && quoteBuffer.length) {
      out.push(
        <blockquote key={key++} className="my-2 border-l-[3px] border-emerald-500/60 bg-emerald-950/15 pl-3 pr-2 py-1.5 italic text-zinc-300 text-[13px] leading-relaxed rounded-r">
          {quoteBuffer.map((l, i) => <div key={i}>{renderInline(l)}</div>)}
        </blockquote>,
      );
    }
    quoteBuffer = null;
  };
  const flushAll = () => { flushList(); flushQuote(); };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (/^###\s/.test(line)) {
      flushAll();
      out.push(<h4 key={key++} className={h3Class}>{renderInline(line.replace(/^###\s+/, ''))}</h4>);
    } else if (/^##\s/.test(line)) {
      flushAll();
      out.push(<h3 key={key++} className={h2Class}>{renderInline(line.replace(/^##\s+/, ''))}</h3>);
    } else if (/^#\s/.test(line)) {
      flushAll();
      out.push(<h2 key={key++} className={h1Class}>{renderInline(line.replace(/^#\s+/, ''))}</h2>);
    } else if (/^>\s?/.test(line)) {
      flushList();
      (quoteBuffer = quoteBuffer || []).push(line.replace(/^>\s?/, ''));
    } else if (/^[-*+]\s/.test(line)) {
      flushQuote();
      if (!listBuffer || listBuffer.ordered) { flushList(); listBuffer = { ordered: false, items: [] }; }
      listBuffer.items.push(line.replace(/^[-*+]\s+/, ''));
    } else if (/^\s*\d+[.)]\s/.test(line)) {
      flushQuote();
      if (!listBuffer || !listBuffer.ordered) { flushList(); listBuffer = { ordered: true, items: [] }; }
      listBuffer.items.push(line.replace(/^\s*\d+[.)]\s+/, ''));
    } else if (!line.trim()) {
      flushAll();
      out.push(<div key={key++} className={editorial ? 'h-2.5' : 'h-1.5'} />);
    } else {
      flushAll();
      const meta = line.match(META_LABEL_RE);
      if (meta) {
        out.push(
          <p key={key++} className={textClass}>
            <span className="font-semibold text-emerald-300 mr-1">{meta[1]}:</span>
            {renderInline(meta[2])}
          </p>,
        );
      } else if (/^━+/.test(line) || /^─+/.test(line) || /^-{3,}$/.test(line) || /^\*{3,}$/.test(line)) {
        out.push(<div key={key++} className="my-3 border-t border-zinc-800/60" />);
      } else {
        out.push(<p key={key++} className={textClass}>{renderInline(line)}</p>);
      }
    }
  }
  flushAll();
  return <div>{out}</div>;
}
