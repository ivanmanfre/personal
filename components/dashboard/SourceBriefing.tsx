import React, { useState } from 'react';
import { ChevronDown, ChevronUp, FileText } from 'lucide-react';

/**
 * Renders the markdown source briefing pulled from the ClickUp task description.
 * That's the raw context Ivan (or the Editorial / Brief agents) wrote when the
 * task was created — "Description / Suggested Angle / Source Story / Quotes" —
 * the material that fed the gen chain. Different from `post_body` (the final
 * LinkedIn copy). Collapsible because some briefings run 1k+ chars.
 *
 * Minimal markdown rendering — preserves H2 headings + bold/italic / code spans /
 * line breaks. Avoids pulling in a full markdown lib for this one surface.
 */

function renderInline(s: string): React.ReactNode[] {
  // Order matters — handle code first so its content isn't reparsed for bold/italic.
  const parts: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < s.length) {
    if (s[i] === '`') {
      const end = s.indexOf('`', i + 1);
      if (end !== -1) {
        parts.push(<code key={key++} className="px-1 py-0.5 rounded bg-zinc-800/80 text-emerald-300 text-[12px] font-mono">{s.slice(i + 1, end)}</code>);
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
    // accumulate plain text until next special token
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

function renderMarkdown(md: string): React.ReactNode {
  const lines = md.split('\n');
  const out: React.ReactNode[] = [];
  let key = 0;
  let listBuffer: string[] | null = null;
  const flushList = () => {
    if (listBuffer && listBuffer.length) {
      out.push(
        <ul key={key++} className="list-disc list-outside pl-5 my-2 space-y-1 text-[13px] text-zinc-300">
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
    } else if (!line.trim()) {
      flushList();
      out.push(<div key={key++} className="h-1.5" />);
    } else {
      flushList();
      out.push(<p key={key++} className="text-[13px] text-zinc-300 leading-snug">{renderInline(line)}</p>);
    }
  }
  flushList();
  return <div>{out}</div>;
}

interface Props {
  description: string | null;
  /** Default: closed if > 240 chars, open otherwise */
  defaultOpen?: boolean;
}

const SourceBriefing: React.FC<Props> = ({ description, defaultOpen }) => {
  const [open, setOpen] = useState(defaultOpen ?? (description ?? '').length <= 240);
  if (!description) return null;
  return (
    <div className="rounded-md border border-zinc-800/60 bg-zinc-900/30">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
      >
        <FileText className="w-3.5 h-3.5 text-emerald-400/70" />
        Source briefing
        <span className="text-[11px] text-zinc-500">· {description.length.toLocaleString()} chars</span>
        <span className="ml-auto text-zinc-500">{open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
      </button>
      {open && (
        <div className="border-t border-zinc-800/60 px-3 py-2 max-h-[50vh] overflow-y-auto">
          {renderMarkdown(description)}
        </div>
      )}
    </div>
  );
};

export default SourceBriefing;
