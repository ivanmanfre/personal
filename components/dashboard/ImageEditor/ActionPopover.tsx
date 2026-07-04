// components/dashboard/ImageEditor/ActionPopover.tsx
import React, { useRef, useState } from 'react';
import { chipsForClass, Chip } from '../../../lib/imagePresets';

export interface ActionPopoverProps {
  objectClass?: string;
  busy?: boolean;
  onAction: (a: { op: 'erase' | 'replace' | 'refine'; prompt: string }) => void;
  onCancel: () => void;
}

export default function ActionPopover(props: ActionPopoverProps) {
  const { objectClass, busy, onAction, onCancel } = props;
  const chips: Chip[] = chipsForClass(objectClass);
  const [freeTextOp, setFreeTextOp] = useState<'erase' | 'replace' | 'refine'>('replace');
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  function handleChipClick(chip: Chip) {
    if (!chip.prompt) {
      // Chip with an empty prompt (e.g. "Replace with…") opens/focuses the free-text field
      // and adopts the chip's op for the eventual Apply, instead of firing immediately.
      setFreeTextOp(chip.op);
      requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }
    onAction({ op: chip.op, prompt: chip.prompt });
  }

  function handleApply() {
    const prompt = text.trim();
    if (!prompt) return;
    onAction({ op: freeTextOp, prompt });
  }

  return (
    <div className="rounded-[var(--ds-radius)] border border-[var(--ds-line)] bg-[var(--ds-card)] p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--ds-dim)]">
          {objectClass ? `Editing: ${objectClass}` : 'Choose an action'}
        </p>
        <button
          onClick={onCancel}
          disabled={busy}
          aria-label="Cancel"
          className="min-h-[44px] min-w-[44px] px-2 rounded-[var(--ds-radius)] text-[var(--ds-dim)] disabled:opacity-50 hover:bg-[var(--ds-bg)]"
        >
          ✕
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {chips.map((chip) => (
          <button
            key={chip.label}
            onClick={() => handleChipClick(chip)}
            disabled={busy}
            className="min-h-[44px] px-3 rounded-[var(--ds-radius)] border border-[var(--ds-line)] text-[var(--ds-ink)] text-sm disabled:opacity-50 hover:bg-[var(--ds-bg)]"
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleApply();
          }}
          disabled={busy}
          placeholder="Describe what you want…"
          className="min-h-[44px] flex-1 px-3 rounded-[var(--ds-radius)] border border-[var(--ds-line)] bg-[var(--ds-bg)] text-[var(--ds-ink)] text-sm disabled:opacity-50"
        />
        <button
          onClick={handleApply}
          disabled={busy || !text.trim()}
          className="min-h-[44px] px-4 rounded-[var(--ds-radius)] bg-[var(--ds-accent)] text-white font-medium disabled:opacity-50 hover:bg-[var(--ds-accent-hover)]"
        >
          Apply
        </button>
      </div>
    </div>
  );
}
