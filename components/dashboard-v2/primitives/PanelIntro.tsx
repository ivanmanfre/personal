import React, { useState } from 'react';

interface PanelIntroProps {
  /** One-line purpose, e.g. "Where every post is born, reviewed, and shipped." */
  purpose: string;
  /** Optional deeper "how it works" shown in a popover behind a "?" */
  how?: string;
  /** data-tour anchor id so the guided tour can target this panel. */
  tourId?: string;
}

export function PanelIntro({ purpose, how, tourId }: PanelIntroProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="dv-panel-intro" data-tour={tourId}>
      <span className="dv-panel-intro-text">{purpose}</span>
      {how && (
        <span className="dv-panel-intro-how">
          <button
            type="button"
            className="dv-panel-intro-q"
            aria-label="How it works"
            aria-expanded={open}
            onClick={() => setOpen(o => !o)}
          >?</button>
          {open && <span className="dv-panel-intro-pop" role="note">{how}</span>}
        </span>
      )}
    </div>
  );
}
