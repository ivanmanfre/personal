import React from 'react';
import { LIFECYCLE_STAGES } from '../lib/lifecycle';

export function LifecycleLegend() {
  return (
    <div className="dv-lifecycle" aria-label="Content lifecycle">
      {LIFECYCLE_STAGES.map((s, i) => (
        <React.Fragment key={s.key}>
          <span className={`dv-lifecycle-stage dv-lifecycle-stage--${s.severity}`}>{s.label}</span>
          {i < LIFECYCLE_STAGES.length - 1 && <span className="dv-lifecycle-arrow" aria-hidden>→</span>}
        </React.Fragment>
      ))}
    </div>
  );
}
