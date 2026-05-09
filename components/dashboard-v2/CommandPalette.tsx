import React, { useRef, useEffect } from 'react';
import type { PaletteItem } from './types';

interface CommandPaletteProps {
  open: boolean;
  query: string;
  setQuery: (q: string) => void;
  filtered: PaletteItem[];
  activeIdx: number;
  setActiveIdx: (i: number) => void;
  selectAt: (i: number) => void;
  close: () => void;
}

export function CommandPalette(props: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (props.open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [props.open]);

  if (!props.open) return null;

  return (
    <div className="dv-cmdk-overlay" role="dialog" aria-modal="true" onClick={props.close}>
      <div className="dv-cmdk" onClick={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          placeholder="Jump to anything — section, post, prompt, prospect, workflow…"
          value={props.query}
          onChange={e => { props.setQuery(e.target.value); props.setActiveIdx(0); }}
        />
        <div className="dv-cmdk-list">
          {props.filtered.length === 0 && (
            <div style={{ padding: '1rem', color: 'var(--d-paper-dimmer)', fontSize: 13 }}>
              No matches. Try typing differently.
            </div>
          )}
          {props.filtered.map((it, i) => (
            <button
              key={it.id}
              className="dv-cmdk-item"
              aria-selected={i === props.activeIdx}
              onMouseEnter={() => props.setActiveIdx(i)}
              onClick={() => props.selectAt(i)}
            >
              <span>{it.label}</span>
              {it.hint && <span className="dv-cmdk-item-kbd">{it.hint}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
