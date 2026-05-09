import React from 'react';

interface ToggleSwitchProps {
  on: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
}

export function ToggleSwitch({ on, onChange, ariaLabel }: ToggleSwitchProps) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      className={`dv-switch ${on ? 'dv-switch--on' : ''}`}
      onClick={() => onChange(!on)}
    />
  );
}

interface ToggleRowProps {
  label: string;
  desc?: string;
  on: boolean;
  onChange: (next: boolean) => void;
}

export function ToggleRow({ label, desc, on, onChange }: ToggleRowProps) {
  return (
    <div className="dv-toggle">
      <div>
        <div className="dv-toggle-lbl">{label}</div>
        {desc && <div className="dv-toggle-desc">{desc}</div>}
      </div>
      <ToggleSwitch on={on} onChange={onChange} ariaLabel={label} />
    </div>
  );
}
