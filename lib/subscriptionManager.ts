import { supabase } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

type Callback = () => void;

interface TableSub {
  channel: RealtimeChannel;
  callbacks: Set<Callback>;
}

const subs = new Map<string, TableSub>();

/**
 * Subscribe to postgres_changes on a table. Returns an unsubscribe function.
 * Deduplicates: multiple callers subscribing to the same table share one channel.
 */
export function subscribeToTable(table: string, callback: Callback): () => void {
  let entry = subs.get(table);

  if (!entry) {
    const channel = supabase
      .channel(`dash-sub-${table}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        const e = subs.get(table);
        if (e) e.callbacks.forEach((cb) => cb());
      })
      .subscribe();
    entry = { channel, callbacks: new Set() };
    subs.set(table, entry);
  }

  entry.callbacks.add(callback);

  return () => {
    const e = subs.get(table);
    if (!e) return;
    e.callbacks.delete(callback);
    if (e.callbacks.size === 0) {
      supabase.removeChannel(e.channel);
      subs.delete(table);
    }
  };
}
