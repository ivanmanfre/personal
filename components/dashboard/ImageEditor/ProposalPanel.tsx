// components/dashboard/ImageEditor/ProposalPanel.tsx
import React from 'react';

export interface ProposalPanelProps {
  beforeUrl: string;
  afterUrl: string;
  busy?: boolean;
  onKeep: () => void;
  onTryAgain: () => void;
  onGoBack: () => void;
  wholeImageHint?: boolean;
}

export default function ProposalPanel(props: ProposalPanelProps) {
  const { beforeUrl, afterUrl, busy, onKeep, onTryAgain, onGoBack, wholeImageHint } = props;
  return (
    <div className="rounded-[var(--ds-radius)] border border-[var(--ds-line)] bg-[var(--ds-card)] p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <figure className="m-0">
          <img src={beforeUrl} alt="Before" className="w-full rounded-[var(--ds-radius)] border border-[var(--ds-line)] object-contain" />
          <figcaption className="mt-1 text-xs text-[var(--ds-dim)]">Before</figcaption>
        </figure>
        <figure className="m-0">
          <img src={afterUrl} alt="After" className="w-full rounded-[var(--ds-radius)] border border-[var(--ds-line)] object-contain" />
          <figcaption className="mt-1 text-xs text-[var(--ds-dim)]">After</figcaption>
        </figure>
      </div>
      {wholeImageHint && (
        <p className="mt-2 text-xs text-[var(--ds-warn)]">This changes the whole image, not just one spot.</p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={onKeep} disabled={busy}
          className="min-h-[44px] px-4 rounded-[var(--ds-radius)] bg-[var(--ds-accent)] text-white font-medium disabled:opacity-50 hover:bg-[var(--ds-accent-hover)]">
          Keep
        </button>
        <button onClick={onTryAgain} disabled={busy}
          className="min-h-[44px] px-4 rounded-[var(--ds-radius)] border border-[var(--ds-line)] text-[var(--ds-ink)] disabled:opacity-50 hover:bg-[var(--ds-bg)]">
          Try again
        </button>
        <button onClick={onGoBack} disabled={busy}
          className="min-h-[44px] px-4 rounded-[var(--ds-radius)] text-[var(--ds-dim)] disabled:opacity-50 hover:bg-[var(--ds-bg)]">
          Go back
        </button>
      </div>
    </div>
  );
}
