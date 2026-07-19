import React, { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'dv2-install-dismissed';

/**
 * One-time install prompt chip for the v2 dashboard.
 * Shown only when:
 *   - browser supports installPrompt
 *   - user hasn't dismissed it before
 *   - app isn't already installed (display-mode: standalone)
 */
export function PwaInstall() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    if (localStorage.getItem(DISMISSED_KEY)) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
      setShown(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!shown || !event) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setShown(false);
  };

  const install = async () => {
    await event.prompt();
    const { outcome } = await event.userChoice;
    if (outcome === 'accepted') {
      setShown(false);
    } else {
      dismiss();
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Install InboundOnSteroids app"
      style={{
        position: 'fixed', bottom: '1rem', right: '1rem', zIndex: 90,
        background: '#FFFFFF', border: '1px solid #131210',
        borderRadius: 0, padding: '0.85rem 1rem', maxWidth: 320,
        boxShadow: 'none',
        fontFamily: "'Schibsted Grotesk', system-ui, sans-serif",
        color: '#131210',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
        Install as a desktop app
      </div>
      <div style={{ fontSize: 12, color: '#6B675E', lineHeight: 1.45, marginBottom: '0.75rem' }}>
        Get a dock icon + native notifications when something needs attention.
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button className="dv-btn dv-btn--bx-ink" onClick={install}>Install</button>
        <button className="dv-btn dv-btn--dim" onClick={dismiss}>Not now</button>
      </div>
    </div>
  );
}
