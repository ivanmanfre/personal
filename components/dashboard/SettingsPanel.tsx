import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { toastError, toastSuccess } from '../../lib/dashboardActions';
import { Bell, Hash, Database, Clock, Plus, Trash2, Search, Lock, Cpu } from 'lucide-react';
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

interface AvailableChannel {
  channel_id: string;
  channel_name: string;
  is_private: boolean;
  num_members: number;
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
  const [availableChannels, setAvailableChannels] = useState<AvailableChannel[]>([]);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [showAddForm, setShowAddForm] = useState(false);
  const [channelSearch, setChannelSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [localSubmission, setLocalSubmission] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [channelsRes, availableRes, tablesRes, localSubRes] = await Promise.all([
        supabase.from('slack_notification_channels').select('*').order('channel_name'),
        supabase.from('slack_available_channels').select('channel_id, channel_name, is_private, num_members').order('channel_name'),
        Promise.all(
          ['own_posts', 'competitor_posts', 'leads', 'n8nclaw_chat_messages', 'n8nclaw_proactive_alerts', 'dashboard_workflow_stats', 'transcripts', 'generated_posts'].map(async (name) => {
            const { count } = await supabase.from(name).select('*', { count: 'exact', head: true });
            return { name, count: count || 0 };
          })
        ),
        supabase.from('integration_config').select('value').eq('key', 'upwork_local_submission').single(),
      ]);
      if (localSubRes.data) setLocalSubmission(localSubRes.data.value === 'true');
      setChannels(channelsRes.data || []);
      setAvailableChannels(availableRes.data || []);
      setTables(tablesRes);
    } catch (err) {
      toastError('load settings', err);
    } finally {
      setLoading(false);
      setLastRefreshed(new Date());
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleChannel = async (id: string, field: 'enabled' | 'mute_bots', value: boolean) => {
    const prev = channels.find((c) => c.id === id);
    setChannels((p) => p.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
    try {
      await supabase.rpc('toggle_slack_channel', { p_id: id, p_field: field, p_value: value });
    } catch (err) {
      toastError('toggle channel', err);
      if (prev) setChannels((p) => p.map((c) => (c.id === id ? { ...c, [field]: prev[field] } : c)));
    }
  };

  const addChannel = async (channelId: string, channelName: string) => {
    setAdding(true);
    try {
      await supabase.rpc('add_slack_channel', {
        p_channel_id: channelId,
        p_channel_name: channelName,
      });
      toastSuccess(`Added #${channelName}`);
      setShowAddForm(false);
      setChannelSearch('');
      fetchData();
    } catch (err) {
      toastError('add channel', err);
    } finally {
      setAdding(false);
    }
  };

  const removeChannel = async (id: string, name: string) => {
    if (!confirm(`Remove #${name} from notifications?`)) return;
    const prev = [...channels];
    setChannels((p) => p.filter((c) => c.id !== id));
    try {
      await supabase.rpc('remove_slack_channel', { p_id: id });
      toastSuccess(`Removed #${name}`);
    } catch (err) {
      toastError('remove channel', err);
      setChannels(prev);
    }
  };

  const toggleLocalSubmission = async (value: boolean) => {
    setLocalSubmission(value);
    try {
      const { error } = await supabase
        .from('integration_config')
        .update({ value: String(value), updated_at: new Date().toISOString() })
        .eq('key', 'upwork_local_submission');
      if (error) throw error;
    } catch (err) {
      toastError('toggle local submission', err);
      setLocalSubmission(!value);
    }
  };

  // Filter available channels: exclude already added ones, apply search
  const activeChannelIds = useMemo(() => new Set(channels.map((c) => c.channel_id)), [channels]);
  const filteredAvailable = useMemo(() => {
    const q = channelSearch.toLowerCase();
    return availableChannels
      .filter((c) => !activeChannelIds.has(c.channel_id))
      .filter((c) => !q || c.channel_name.toLowerCase().includes(q));
  }, [availableChannels, activeChannelIds, channelSearch]);

  if (loading) return <LoadingSkeleton cards={2} rows={4} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={fetchData} />
      </div>

      {/* Auto-refresh interval */}
      <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl shadow-sm shadow-black/10 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800/40 bg-zinc-800/20 flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-zinc-500" />
          <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-[0.12em]">Auto-Refresh Interval</h2>
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

      {/* Upwork Local Submission */}
      <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl shadow-sm shadow-black/10 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800/40 bg-zinc-800/20 flex items-center gap-2">
          <Cpu className="w-3.5 h-3.5 text-zinc-500" />
          <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-[0.12em]">Upwork Local Submission</h2>
        </div>
        <div className="px-4 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-zinc-300">Submit proposals via local Chrome</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">When enabled, proposals are submitted through your laptop&apos;s Chrome browser. Falls back to cloud BQL when off.</p>
          </div>
          <Toggle checked={localSubmission} onChange={toggleLocalSubmission} activeColor="bg-emerald-500" />
        </div>
      </div>

      {/* Slack Notifications */}
      <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl shadow-sm shadow-black/10 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800/40 bg-zinc-800/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-3.5 h-3.5 text-zinc-500" />
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-[0.12em]">Slack Channel Notifications</h2>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
          >
            <Plus className="w-3 h-3" /> Add Channel
          </button>
        </div>

        {/* Channel picker */}
        {showAddForm && (
          <div className="border-b border-zinc-800/40 bg-zinc-800/20">
            <div className="px-4 py-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                <label htmlFor="channel-search" className="sr-only">Search channels</label>
                <input
                  id="channel-search"
                  value={channelSearch}
                  onChange={(e) => setChannelSearch(e.target.value)}
                  placeholder="Search channels..."
                  autoFocus
                  className="w-full pl-9 pr-3 py-2 bg-zinc-900/80 border border-zinc-700/60 rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
                />
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto dashboard-scroll divide-y divide-zinc-800/30">
              {availableChannels.length === 0 ? (
                <div className="px-4 py-6 text-center text-zinc-600 text-xs">
                  No channels loaded yet. Channels sync every 5 minutes via Dashboard Data Sync.
                </div>
              ) : filteredAvailable.length === 0 ? (
                <div className="px-4 py-4 text-center text-zinc-600 text-xs">
                  {channelSearch ? 'No matching channels found' : 'All available channels already added'}
                </div>
              ) : (
                filteredAvailable.slice(0, 20).map((ch) => (
                  <button
                    key={ch.channel_id}
                    onClick={() => addChannel(ch.channel_id, ch.channel_name)}
                    disabled={adding}
                    className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-zinc-700/30 transition-colors text-left disabled:opacity-40"
                  >
                    <Hash className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-zinc-300">{ch.channel_name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {ch.is_private && <Lock className="w-3 h-3 text-zinc-600" />}
                      <span className="text-[10px] text-zinc-600">{ch.num_members} members</span>
                    </div>
                  </button>
                ))
              )}
              {filteredAvailable.length > 20 && (
                <div className="px-4 py-2 text-center text-[11px] text-zinc-600">
                  +{filteredAvailable.length - 20} more &mdash; type to search
                </div>
              )}
            </div>
          </div>
        )}

        {channels.length === 0 && !showAddForm ? (
          <div className="p-10 text-center text-zinc-600 text-sm">
            No Slack channels configured. Click &quot;Add Channel&quot; to get started.
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/40">
            {channels.map((ch) => (
              <div key={ch.id} className="px-4 py-3 flex items-center gap-4 hover:bg-zinc-800/30 transition-colors">
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
      <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl shadow-sm shadow-black/10 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800/40 bg-zinc-800/20 flex items-center gap-2">
          <Database className="w-3.5 h-3.5 text-zinc-500" />
          <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-[0.12em]">System Info</h2>
        </div>
        <div className="divide-y divide-zinc-800/40">
          {tables.map((t) => (
            <div key={t.name} className="px-4 py-2.5 flex items-center justify-between hover:bg-zinc-800/30 transition-colors">
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
    role="switch"
    aria-checked={checked}
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
