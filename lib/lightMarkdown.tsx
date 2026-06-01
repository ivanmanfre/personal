import React from 'react';

// Lightweight markdown renderer for QA/Editorial agent bodies and source
// briefings. Supports: # / ## headings, **bold**, *italic*, `code`, bullet
// lists (- / * / +), paragraph breaks on blank lines, and "Label: value"
// detection for ClickUp-style metadata lines.

function renderInline(s: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < s.length) {
    if (s[i] === '`') {
      const end = s.indexOf('`', i + 1);
      if (end !== -1) {
        parts.push(<code key={key++} className="px-1 py-0.5 rounded bg-zinc-800/80 text-emerald-300 text-[11.5px] font-mono">{s.slice(i + 1, end)}</code>);
        i = end + 1;
        continue;
      }
    }
    if (s.startsWith('**', i)) {
      const end = s.indexOf('**', i + 2);
      if (end !== -1) {
        parts.push(<strong key={key++} className="text-zinc-100 font-semibold">{s.slice(i + 2, end)}</strong>);
        i = end + 2;
        continue;
      }
    }
    if (s[i] === '*' && s[i + 1] !== '*') {
      const end = s.indexOf('*', i + 1);
      if (end !== -1 && end !== i + 1) {
        parts.push(<em key={key++} className="italic text-zinc-200">{s.slice(i + 1, end)}</em>);
        i = end + 1;
        continue;
      }
    }
    const nextSpecial = (() => {
      for (let j = i; j < s.length; j++) {
        if (s[j] === '`' || s[j] === '*') return j;
      }
      return s.length;
    })();
    parts.push(s.slice(i, nextSpecial === i ? i + 1 : nextSpecial));
    i = nextSpecial === i ? i + 1 : nextSpecial;
  }
  return parts;
}

const META_LABEL_RE = /^(Status|Verdict|Score|Confidence|Source|Agent|Category|Pillar|Hook|Tier|Topic|Style|Format|Briefing|Angle|Audience|Reasoning|Issues|Suggestions|Rewrite|Notes|Reactions|Comments|Shares|Saves|Impressions)\s*[:|—-]\s*(.*)$/i;

export function renderLightMarkdown(md: string, opts?: { textClass?: string }): React.ReactNode {
  if (!md) return null;
  const textClass = opts?.textClass || 'text-[12.5px] text-zinc-300 leading-snug';
  const lines = md.split('\n');
  const out: React.ReactNode[] = [];
  let key = 0;
  let listBuffer: string[] | null = null;
  const flushList = () => {
    if (listBuffer && listBuffer.length) {
      out.push(
        <ul key={key++} className={`list-disc list-outside pl-5 my-1.5 space-y-0.5 ${textClass}`}>
          {listBuffer.map((l, i) => <li key={i}>{renderInline(l)}</li>)}
        </ul>,
      );
    }
    listBuffer = null;
  };
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (/^##\s/.test(line)) {
      flushList();
      out.push(<h3 key={key++} className="text-[11px] uppercase tracking-wider text-emerald-400/70 font-semibold mt-3 mb-1">{line.replace(/^##\s+/, '')}</h3>);
    } else if (/^#\s/.test(line)) {
      flushList();
      out.push(<h3 key={key++} className="text-[12px] uppercase tracking-wider text-emerald-400/80 font-semibold mt-3 mb-1">{line.replace(/^#\s+/, '')}</h3>);
    } else if (/^[-*+]\s/.test(line)) {
      (listBuffer = listBuffer || []).push(line.replace(/^[-*+]\s+/, ''));
    } else if (/^\s*\d+\.\s/.test(line)) {
      // Numbered list entry — flatten into the same buffer (visually OK)
      (listBuffer = listBuffer || []).push(line.replace(/^\s*\d+\.\s+/, ''));
    } else if (!line.trim()) {
      flushList();
      out.push(<div key={key++} className="h-1.5" />);
    } else {
      flushList();
      const meta = line.match(META_LABEL_RE);
      if (meta) {
        out.push(
          <p key={key++} className={textClass}>
            <span className="font-semibold text-emerald-300 mr-1">{meta[1]}:</span>
            {renderInline(meta[2])}
          </p>,
        );
      } else if (/^━+/.test(line) || /^─+/.test(line)) {
        // Pretty separator lines from agent output
        out.push(<div key={key++} className="my-2 border-t border-zinc-800/60" />);
      } else {
        out.push(<p key={key++} className={textClass}>{renderInline(line)}</p>);
      }
    }
  }
  flushList();
  return <div>{out}</div>;
}
