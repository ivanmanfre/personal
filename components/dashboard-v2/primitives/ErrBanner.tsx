import React from 'react';
import { BtnGhost } from './BtnGhost';

interface ErrBannerProps {
  title: string;
  body: string;
  resolveLabel?: string;
  onResolve?: () => void;
  resolveHref?: string;
}

export function ErrBanner({ title, body, resolveLabel, onResolve, resolveHref }: ErrBannerProps) {
  return (
    <div className="dv-err-banner" role="alert">
      <span className="dv-err-banner-ico">!</span>
      <span className="dv-err-banner-txt">
        <strong>{title}</strong> {body}
      </span>
      {(resolveLabel && (onResolve || resolveHref)) && (
        <BtnGhost variant="dim" onClick={onResolve} href={resolveHref}>{resolveLabel}</BtnGhost>
      )}
    </div>
  );
}
