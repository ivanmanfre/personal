import React from 'react';
import type { ProfileAudit } from './model';
import './profile-audit.css';

/** Flagged builds only. Every quote was checked against the lead's own profile when the scan was built. */
export function ProfileAuditSection({ audit }: { audit: ProfileAudit }) {
  return <section className="story-scene profile-audit" id="profile" aria-label="Your LinkedIn profile">
    <header className="scene-heading"><h2>Your LinkedIn profile</h2><p>What a buyer finds when they open your profile, with one fix for each part.</p></header>
    <ol className="profile-findings">{audit.findings.map(f => <li key={f.area || f.label} className="profile-finding" data-state={f.state}>
      <span className="profile-finding-label">{f.label}</span>
      <p className="profile-finding-today">{f.today}</p>
      {f.quote && <blockquote>“{f.quote}”</blockquote>}
      <p className="profile-finding-fix"><b>Fix</b>{f.fix}</p>
    </li>)}</ol>
  </section>;
}
