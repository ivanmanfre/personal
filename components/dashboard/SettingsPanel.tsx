import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Bell, Hash, Database, Clock } from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import LoadingSkeleton from './shared/LoadingSkeleton';
import RefreshIndicator from './shared/RefreshIndicator';
import type { RefreshRate } from '../../types/dashboard';

interface SlackChannel {
  id: string;
  channel_id: string;
  channel_name: string;
  enabled: boolean;
  notify_on_keywords: string[] | null;
  mute_bots: boolean;
}

interface TableInfo {
  name: string;
  count: number;
}

const refreshOptions: { label: string; value: RefreshRate }[] = [
  { label: '30s', value: 30000 },
  { label: '1 min', value: 60000 },
  { label: '5 min', value: 300000 },
];

const SettingsPanel: React.FC = () => {
  const { refreshRate, setRefreshRate } = useDashboard();
  const [channels, setChannels] = useState<SlackChannel[]>([]);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  const fetchData = useCallback(async () => {
    setLoading(true);

    const [channelsRes, tablesRes] = await Promise.all([
      supabase.from('slack_notification_channels').select('*').order('channel_name'),
      Promise.all(
        ['own_posts', 'competitor_posts', 'leads', 'n8nclaw_chat_messages', 'n8nclaw_proactive_alerts', 'dashboard_workflow_stats', 'transcripts', 'generated_posts'].map(async (name) => {
          const { count } = await supabase.from(name).select('*', { count: 'exact', head: true });
          return { name, count: count || 0 };
        })
      ),
    ]);

    setChannels(channelsRes.data || []);
    setTables(tablesRes);
    setLoading(false);
    setLastRefreshed(new Date());
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleChannel = async (id: string, field: 'enabled' | 'mute_bots', value: boolean) => {
    setChannels((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
    await supabase.rpc('toggle_slack_channel', { p_id: id, p_field: field, p_value: value });
  };

  if (loading) return <LoadingSkeleton cards={2} rows={4} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Settings</h1>
        <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={fetchData} />
      </div>

      {/* Auto-refresh interval */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
          <Clock className="w-4 h-4 text-zinc-400" />
          <h2 className="text-sm font-semibold text-zinc-300">Auto-Refresh Interval</h2>
        </div>
        <div className="px-4 py-4 flex items-center gap-2">
          {refreshOptions.map((opt) => (
            <button key={opt.value} onClick={() => setRefreshRate(opt.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${refreshRate === opt.value ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:text-white'}`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Slack Notifications */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
          <Bell className="w-4 h-4 text-zinc-400" />
          <h2 className="text-sm font-semibold text-zinc-300">Slack Channel Notifications</h2>
        </div>
        {channels.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 text-sm">
            No Slack channels configured. Add channels via WhatsApp.
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {channels.map((ch) => (
              <div key={ch.id} className="px-4 py-3 flex items-center gap-4">
                <Hash className="w-4 h-4 text-zinc-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-200">{ch.channel_name}</p>
                  {ch.notify_on_keywords && ch.notify_on_keywords.length > 0 && (
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Keywords: {ch.notify_on_keywords.join(', ')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-xs text-zinc-500">Mute bots</span>
                    <Toggle checked={ch.mute_bots} onChange={(v) => toggleChannel(ch.id, 'mute_bots', v)} />
                  </label>
                  <Toggle
                    checked={ch.enabled}
                    onChange={(v) => toggleChannel(ch.id, 'enabled', v)}
                    activeColor="bg-emerald-500"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* System Info */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
          <Database className="w-4 h-4 text-zinc-400" />
          <h2 className="text-sm font-semibold text-zinc-300">System Info</h2>
        </div>
        <div className="divide-y divide-zinc-800">
          {tables.map((t) => (
            <div key={t.name} className="px-4 py-2.5 flex items-center justify-between">
              <span className="text-sm text-zinc-400 font-mono">{t.name}</span>
              <span className="text-sm text-zinc-300 font-medium">{t.count.toLocaleString()} rows</span>
            </div>
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-zinc-300 mb-2">Managing Settings</h3>
        <p className="text-xs text-zinc-500 leading-relaxed">
          Most settings can be managed via WhatsApp commands through n8nClaw. Use &quot;manage slack notifications&quot; to add/remove channels, or toggle them directly here.
        </p>
      </div>
    </div>
  );
};

interface ToggleProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  activeColor?: string;
}

const Toggle: React.FC<ToggleProps> = ({ checked, onChange, activeColor = 'bg-emerald-500' }) => (
  <button
    onClick={() => onChange(!checked)}
    className={`relative w-10 h-5 rounded-full transition-colors ${checked ? activeColor : 'bg-zinc-700'}`}
  >
    <span
      className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
        checked ? 'translate-x-5' : ''
      }`}
    />
  </button>
);

export default SettingsPanel;
