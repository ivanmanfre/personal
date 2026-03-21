import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { dashboardAction, toastError } from '../lib/dashboardActions';
import type { ProactiveAlert, Reminder, ChatMessage, DailySummary } from '../types/dashboard';

export function useAgentData() {
  const [alerts, setAlerts] = useState<ProactiveAlert[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [messageStats, setMessageStats] = useState({ total: 0, today: 0, thisWeek: 0 });
  const [summaries, setSummaries] = useState<DailySummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekStart = new Date(now.getTime() - 7 * 86400000).toISOString();

    const [alertsRes, remindersRes, totalRes, todayRes, weekRes, summariesRes] = await Promise.all([
      supabase.from('n8nclaw_proactive_alerts').select('id, alert_type, title, body, sent, sent_at, created_at')
        .order('created_at', { ascending: false }).limit(50),
      supabase.from('n8nclaw_reminders').select('id, reminder_text, remind_at, status, recurrence, created_at')
        .eq('status', 'pending').order('remind_at'),
      supabase.from('n8nclaw_chat_messages').select('id', { count: 'exact', head: true }),
      supabase.from('n8nclaw_chat_messages').select('id', { count: 'exact', head: true })
        .gte('created_at', todayStart),
      supabase.from('n8nclaw_chat_messages').select('id', { count: 'exact', head: true })
        .gte('created_at', weekStart),
      supabase.from('n8nclaw_daily_summaries').select('id, date, summary, topics, action_items, message_count, created_at')
        .order('date', { ascending: false }).limit(7),
    ]);

    setAlerts((alertsRes.data || []).map((r: any) => ({
      id: r.id, alertType: r.alert_type, title: r.title, body: r.body,
      sent: r.sent, sentAt: r.sent_at, createdAt: r.created_at,
    })));
    setReminders((remindersRes.data || []).map((r: any) => ({
      id: r.id, reminderText: r.reminder_text, remindAt: r.remind_at,
      status: r.status, recurrence: r.recurrence, createdAt: r.created_at,
    })));
    setMessageStats({
      total: totalRes.count || 0,
      today: todayRes.count || 0,
      thisWeek: weekRes.count || 0,
    });
    setSummaries((summariesRes.data || []).map((r: any) => ({
      id: r.id, date: r.date, summary: r.summary, topics: r.topics || [],
      actionItems: r.action_items || [], messageCount: r.message_count || 0, createdAt: r.created_at,
    })));
    } catch (err) {
      toastError('load agent data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const alertsByType = useMemo(() =>
    alerts.reduce((acc: Record<string, number>, a) => {
      acc[a.alertType] = (acc[a.alertType] || 0) + 1;
      return acc;
    }, {}),
    [alerts]
  );

  const acknowledgeAlert = useCallback(async (id: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, sent: true } : a)));
    try {
      await dashboardAction('n8nclaw_proactive_alerts', id, 'sent', 'true');
      await fetch();
    } catch (err) {
      toastError('acknowledge alert', err);
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, sent: false } : a)));
    }
  }, [fetch]);

  const completeReminder = useCallback(async (id: number) => {
    const prev = reminders.find((r) => r.id === id);
    setReminders((p) => p.filter((r) => r.id !== id));
    try {
      await dashboardAction('n8nclaw_reminders', String(id), 'status', 'completed');
      await fetch();
    } catch (err) {
      toastError('complete reminder', err);
      if (prev) setReminders((p) => [...p, prev]);
    }
  }, [fetch, reminders]);

  return { alerts, reminders, messageStats, summaries, alertsByType, loading, refresh: fetch, acknowledgeAlert, completeReminder };
}
