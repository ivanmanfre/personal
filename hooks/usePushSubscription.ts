import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const VAPID_PUBLIC_KEY = (import.meta as any).env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export type PushPermissionState = 'unsupported' | 'denied' | 'granted' | 'default' | 'no-vapid';

export function usePushSubscription() {
  const [state, setState] = useState<PushPermissionState>('default');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported');
      return;
    }
    if (!VAPID_PUBLIC_KEY) {
      setState('no-vapid');
      return;
    }
    setState(Notification.permission as PushPermissionState);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const subscribe = useCallback(async () => {
    if (!VAPID_PUBLIC_KEY) throw new Error('VITE_VAPID_PUBLIC_KEY missing — cannot subscribe');
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission as PushPermissionState);
        return false;
      }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }
      const json = sub.toJSON();
      const { endpoint, keys } = json;
      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        throw new Error('Subscription missing endpoint/keys');
      }

      // Upsert into push_subscriptions (UNIQUE on endpoint)
      await supabase
        .from('push_subscriptions')
        .upsert(
          {
            endpoint,
            p256dh: keys.p256dh,
            auth: keys.auth,
            user_agent: navigator.userAgent.slice(0, 200),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'endpoint' }
        );

      setState('granted');
      return true;
    } finally {
      setBusy(false);
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
      }
      setState('default');
    } finally {
      setBusy(false);
    }
  }, []);

  const sendTest = useCallback(async () => {
    // Calls the edge function to fire a test notification at ALL active subs
    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body: {
        title: 'Test notification',
        body: 'Push wiring works ✓',
        severity: 'good',
        deeplink: '/dashboard-v2',
      },
    });
    if (error) throw error;
    return data;
  }, []);

  return { state, busy, subscribe, unsubscribe, sendTest, refresh };
}
