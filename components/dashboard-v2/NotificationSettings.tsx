import React, { useState } from 'react';
import { usePushSubscription } from '../../hooks/usePushSubscription';
import { Card, BtnGhost, ToggleRow, SectionLabel, Marginalia } from './primitives';
import { toast } from 'sonner';

/**
 * Notification settings panel — opt-in to web push.
 * Shows current permission state, lets user enable/disable, and sends
 * a test notification through the send-push-notification edge fn.
 */
export function NotificationSettings() {
  const { state, busy, subscribe, unsubscribe, sendTest } = usePushSubscription();
  const [redOnly, setRedOnly] = useState(true);

  const handleToggle = async (next: boolean) => {
    try {
      if (next) await subscribe();
      else await unsubscribe();
    } catch (err) {
      toast.error('Push subscription failed: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleTest = async () => {
    try {
      await sendTest();
      toast.success('Test notification dispatched. Check your system tray.');
    } catch (err) {
      toast.error('Test failed: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  if (state === 'unsupported') {
    return (
      <Marginalia variant="warn">
        This browser doesn't support push notifications. Use Safari, Chrome, or Edge on macOS.
      </Marginalia>
    );
  }

  if (state === 'no-vapid') {
    return (
      <Marginalia variant="warn">
        <em>VITE_VAPID_PUBLIC_KEY missing.</em> Generate keys with{' '}
        <code>npx web-push generate-vapid-keys</code>, set{' '}
        <code>VITE_VAPID_PUBLIC_KEY</code> in <code>.env</code>, and store the
        private key as a Supabase secret (<code>VAPID_PRIVATE_KEY</code>).
      </Marginalia>
    );
  }

  return (
    <>
      <SectionLabel label="Notifications" />
      <Card label="Native push" title={<>Native macOS / browser <em>notifications</em></>}>
        <p style={{ marginBottom: '0.85rem' }}>
          Subscribe this device to push notifications. Triggered by n8n on RED
          dispatches (failed posts, high-severity client errors, stuck agent
          alerts). Routes through the <code>send-push-notification</code> edge
          function.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
          <span style={{ fontSize: 12, color: 'var(--d-paper-dim)' }}>
            Permission: <strong style={{ color: state === 'granted' ? 'var(--d-good)' : state === 'denied' ? 'var(--d-bad)' : 'var(--d-warn)' }}>{state}</strong>
          </span>
          {state === 'granted' ? (
            <BtnGhost variant="dim" onClick={() => handleToggle(false)}>Unsubscribe</BtnGhost>
          ) : (
            <BtnGhost variant="good" onClick={() => handleToggle(true)}>{busy ? '…' : 'Enable push'}</BtnGhost>
          )}
          {state === 'granted' && (
            <BtnGhost onClick={handleTest}>Send test</BtnGhost>
          )}
        </div>
      </Card>

      <ToggleRow
        label="RED dispatches only"
        desc="Push only on critical events. Amber items show in tab badges; sage stays quiet."
        on={redOnly}
        onChange={setRedOnly}
      />
    </>
  );
}
