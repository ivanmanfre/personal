// components/dashboard/ImageEditor/CommandBar.tsx
import React, { useState } from 'react';
import { parseCommand } from '../../../lib/imagePresets';

export interface CommandBarProps {
  busy?: boolean;
  onSubmit: (prompt: string) => void;
}

const STARTERS = ['make it warmer', 'more contrast', 'simplify this background'];

export default function CommandBar(props: CommandBarProps) {
  const { busy, onSubmit } = props;
  const [text, setText] = useState('');

  function submit() {
    const intent = parseCommand(text);
    if (!intent) return;
    onSubmit(intent.prompt);
  }

  return (
    <div className="rounded-[var(--ds-radius)] border border-[var(--ds-line)] bg-[var(--ds-card)] p-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          disabled={busy}
          placeholder="Type a whole-image edit, e.g. make it warmer"
          className="min-h-[44px] flex-1 px-3 rounded-[var(--ds-radius)] border border-[var(--ds-line)] bg-[var(--ds-bg)] text-[var(--ds-ink)] text-sm disabled:opacity-50"
        />
        <button
          onClick={submit}
          disabled={busy || !text.trim()}
          className="min-h-[44px] px-4 rounded-[var(--ds-radius)] bg-[var(--ds-accent)] text-white font-medium disabled:opacity-50 hover:bg-[var(--ds-accent-hover)]"
        >
          Send
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {STARTERS.map((s) => (
          <button
            key={s}
            onClick={() => setText(s)}
            disabled={busy}
            className="min-h-[44px] px-3 rounded-[var(--ds-radius)] border border-[var(--ds-line)] text-[var(--ds-dim)] text-xs disabled:opacity-50 hover:bg-[var(--ds-bg)]"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
