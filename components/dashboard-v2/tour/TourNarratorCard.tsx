import React from 'react';
import { useTour } from './TourProvider';
import { useTourSpotlight } from './useTourSpotlight';

export function TourNarratorCard() {
  const { active, step, index, total, next, back, end } = useTour();
  useTourSpotlight(active, step?.target);

  if (!active || !step) return null;
  const isFirst = index === 0;
  const isLast = index === total - 1;

  return (
    <>
      <div className="dv-tour-scrim" onClick={end} aria-hidden />
      <aside className="dv-tour-card" role="dialog" aria-label="Guided tour">
        <div className="dv-tour-progress">{index + 1} / {total}</div>
        <h3 className="dv-tour-title">{step.title}</h3>
        <p className="dv-tour-body">{step.body}</p>
        <div className="dv-tour-actions">
          <button type="button" className="dv-tour-skip" onClick={end}>End tour</button>
          <div className="dv-tour-nav">
            {!isFirst && <button type="button" className="dv-tour-btn" onClick={back}>Back</button>}
            {isLast
              ? <button type="button" className="dv-tour-btn dv-tour-btn--primary" onClick={end}>Done</button>
              : <button type="button" className="dv-tour-btn dv-tour-btn--primary" onClick={next}>Next</button>}
          </div>
        </div>
      </aside>
    </>
  );
}
