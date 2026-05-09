import React from 'react';

interface ActionCardProps {
  verb: string;
  when: string;
  head: React.ReactNode;
  body: React.ReactNode;
  cta?: { label: string; onClick?: () => void; href?: string };
  warn?: boolean;
}

export function ActionCard({ verb, when, head, body, cta, warn }: ActionCardProps) {
  return (
    <div className={`dv-action-card ${warn ? 'dv-action-card--warn' : ''}`}>
      <div className="dv-action-card-verb-row">
        <span className="dv-action-card-verb">{verb}</span>
        <span className="dv-action-card-when">{when}</span>
      </div>
      <div className="dv-action-card-head">{head}</div>
      <div className="dv-action-card-body">{body}</div>
      {cta && (
        cta.href ? (
          <a className="dv-btn" href={cta.href} style={{ marginTop: 'auto', alignSelf: 'flex-start' }}>{cta.label}</a>
        ) : (
          <button className="dv-btn" onClick={cta.onClick} style={{ marginTop: 'auto', alignSelf: 'flex-start' }}>{cta.label}</button>
        )
      )}
    </div>
  );
}

export function ActionGrid({ children }: { children: React.ReactNode }) {
  return <div className="dv-action-grid">{children}</div>;
}
