import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { RefreshCw, Bell, Hash } from 'lucide-react';

interface SlackChannel {
  id: string;
  channel_id: string;
  channel_name: string;
  enabled: boolean;
  notify_on_keywords: string[] | null;
  mute_bots: boolean;
}

const SettingsPanel: React.FC = () => {
  const [channels, setChannels] = useState<SlackChannel[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('slack_notification_channels')
      .select('*')
      .order('channel_name');
    setChannels(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const toggleChannel = async (id: string, enabled: boolean) => {
    setChannels((prev) => prev.map((c) => (c.id === id ? { ...c, enabled } : c)));
    await supabase.from('slack_notification_channels').update({ enabled }).eq('id', id);
  };

  const toggleMuteBots = async (id: string, mute_bots: boolean) => {
    setChannels((prev) => prev.map((c) => (c.id === id ? { ...c, mute_bots } : c)));
    await supabase.from('slack_notification_channels').update({ mute_bots }).eq('id', id);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Settings</h1>
        <button onClick={fetchData} className="text-zinc-400 hover:text-white transition-colors">
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Slack Notifications */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
          <Bell className="w-4 h-4 text-zinc-400" />
          <h2 className="text-sm font-semibold text-zinc-300">Slack Channel Notifications</h2>
        </div>

        {loading ? (
          <div className="p-4 space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-zinc-800 rounded-lg" />
            ))}
          </div>
        ) : channels.length === 0 ? (
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
                    <Toggle checked={ch.mute_bots} onChange={(v) => toggleMuteBots(ch.id, v)} />
                  </label>
                  <Toggle
                    checked={ch.enabled}
                    onChange={(v) => toggleChannel(ch.id, v)}
                    activeColor="bg-emerald-500"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-zinc-300 mb-2">Managing Settings</h3>
        <p className="text-xs text-zinc-500 leading-relaxed">
          Most settings can be managed via WhatsApp commands through n8nClaw. Use "manage slack notifications" to add/remove channels, or toggle them directly here.
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
