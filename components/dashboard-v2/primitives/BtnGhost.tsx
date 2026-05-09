import React from 'react';

interface BtnGhostProps {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: 'default' | 'dim' | 'good' | 'bad';
  type?: 'button' | 'submit';
}

export function BtnGhost({ children, onClick, href, variant = 'default', type = 'button' }: BtnGhostProps) {
  const cls = `dv-btn ${variant !== 'default' ? `dv-btn--${variant}` : ''}`;
  if (href) return <a className={cls} href={href}>{children}</a>;
  return <button className={cls} type={type} onClick={onClick}>{children}</button>;
}
