import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Bell, Hash, Database, Clock, Plus, Trash2 } from 'lucide-react';
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
  const [showAddForm, setShowAddForm] = useState(false);
  const [newChannelId, setNewChannelId] = useState('');
  const [newChannelName, setNewChannelName] = useState('');
  const [adding, setAdding] = useState(false);

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

  const addChannel = async () => {
    if (!newChannelId.trim() || !newChannelName.trim()) return;
    setAdding(true);
    await supabase.rpc('add_slack_channel', {
      p_channel_id: newChannelId.trim(),
      p_channel_name: newChannelName.trim(),
    });
    setNewChannelId('');
    setNewChannelName('');
    setShowAddForm(false);
    setAdding(false);
    fetchData();
  };

  const removeChannel = async (id: string, name: string) => {
    if (!confirm(`Remove #${name} from notifications?`)) return;
    setChannels((prev) => prev.filter((c) => c.id !== id));
    await supabase.rpc('remove_slack_channel', { p_id: id });
  };

  if (loading) return <LoadingSkeleton cards={2} rows={4} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={fetchData} />
      </div>

      {/* Auto-refresh interval */}
      <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800/60 flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-zinc-500" />
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Auto-Refresh Interval</h2>
        </div>
        <div className="px-4 py-4 flex items-center gap-2">
          {refreshOptions.map((opt) => (
            <button key={opt.value} onClick={() => setRefreshRate(opt.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${refreshRate === opt.value ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-800/60 text-zinc-400 border border-zinc-700/40 hover:text-white hover:border-zinc-600'}`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Slack Notifications */}
      <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-3.5 h-3.5 text-zinc-500" />
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Slack Channel Notifications</h2>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
          >
            <Plus className="w-3 h-3" /> Add Channel
          </button>
        </div>

        {/* Add form */}
        {showAddForm && (
          <div className="px-4 py-3 border-b border-zinc-800/60 bg-zinc-800/20">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="text-[11px] text-zinc-500 block mb-1">Channel ID</label>
                <input
                  value={newChannelId}
                  onChange={(e) => setNewChannelId(e.target.value)}
                  placeholder="C01ABC123"
                  className="w-full px-3 py-1.5 bg-zinc-900/80 border border-zinc-700/60 rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
                />
              </div>
              <div className="flex-1">
                <label className="text-[11px] text-zinc-500 block mb-1">Channel Name</label>
                <input
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  placeholder="general"
                  className="w-full px-3 py-1.5 bg-zinc-900/80 border border-zinc-700/60 rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
                  onKeyDown={(e) => e.key === 'Enter' && addChannel()}
                />
              </div>
              <button
                onClick={addChannel}
                disabled={adding || !newChannelId.trim() || !newChannelName.trim()}
                className="px-4 py-1.5 rounded-lg text-sm font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {adding ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>
        )}

        {channels.length === 0 && !showAddForm ? (
          <div className="p-10 text-center text-zinc-600 text-sm">
            No Slack channels configured. Click &quot;Add Channel&quot; to get started.
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/50">
            {channels.map((ch) => (
              <div key={ch.id} className="px-4 py-3 flex items-center gap-4 hover:bg-zinc-800/20 transition-colors">
                <Hash className="w-4 h-4 text-zinc-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-200">{ch.channel_name}</p>
                  {ch.notify_on_keywords && ch.notify_on_keywords.length > 0 && (
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      Keywords: {ch.notify_on_keywords.join(', ')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-[11px] text-zinc-500">Mute bots</span>
                    <Toggle checked={ch.mute_bots} onChange={(v) => toggleChannel(ch.id, 'mute_bots', v)} />
                  </label>
                  <Toggle
                    checked={ch.enabled}
                    onChange={(v) => toggleChannel(ch.id, 'enabled', v)}
                    activeColor="bg-emerald-500"
                  />
                  <button
                    onClick={() => removeChannel(ch.id, ch.channel_name)}
                    className="p-1 rounded text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Remove channel"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* System Info */}
      <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800/60 flex items-center gap-2">
          <Database className="w-3.5 h-3.5 text-zinc-500" />
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">System Info</h2>
        </div>
        <div className="divide-y divide-zinc-800/50">
          {tables.map((t) => (
            <div key={t.name} className="px-4 py-2.5 flex items-center justify-between hover:bg-zinc-800/20 transition-colors">
              <span className="text-sm text-zinc-400 font-mono text-[13px]">{t.name}</span>
              <span className="text-sm text-zinc-300 font-medium tabular-nums">{t.count.toLocaleString()} rows</span>
            </div>
          ))}
        </div>
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
    className={`relative w-10 h-[22px] rounded-full transition-colors duration-200 ${checked ? activeColor : 'bg-zinc-700'}`}
  >
    <span
      className={`absolute top-[3px] left-[3px] w-4 h-4 bg-white rounded-full transition-transform duration-200 shadow-sm ${
        checked ? 'translate-x-[18px]' : ''
      }`}
    />
  </button>
);

export default SettingsPanel;
