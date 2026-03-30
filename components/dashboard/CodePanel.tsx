import React, { useState, useEffect } from 'react';
import { Terminal, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const BASE_URL = import.meta.env.VITE_CLAUDE_CODE_URL || 'https://claude-code-railway-production.up.railway.app';

interface Client {
  client_id: string;
  display_name: string;
}

const CodePanel: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<string>('ivan');
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    supabase
      .from('client_registry')
      .select('client_id, display_name')
      .eq('is_active', true)
      .then(({ data }) => {
        if (data) setClients(data);
      });
  }, []);

  const iframeSrc = `${BASE_URL}#workspace=${activeWorkspace}`;

  const activeClient = clients.find(c => c.client_id === activeWorkspace);
  const activeLabel = activeClient?.display_name || activeWorkspace;

  return (
    <>
      {/* Workspace switcher bar */}
      <div className="fixed top-14 md:top-0 left-0 md:left-[240px] right-0 z-20 bg-zinc-900/95 backdrop-blur-md border-b border-zinc-800/60 px-3 py-1.5 flex items-center gap-2">
        <Terminal className="w-4 h-4 text-emerald-400 shrink-0" />
        <div className="relative">
          <button
            onClick={() => setShowPicker(!showPicker)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-800/80 hover:bg-zinc-700/80 text-sm font-medium text-zinc-200 transition-colors"
          >
            {activeLabel}
            <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
          </button>
          {showPicker && (
            <div className="absolute top-full left-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 min-w-[180px] z-30">
              {clients.map(c => (
                <button
                  key={c.client_id}
                  onClick={() => { setActiveWorkspace(c.client_id); setShowPicker(false); }}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                    c.client_id === activeWorkspace
                      ? 'text-emerald-400 bg-emerald-500/10'
                      : 'text-zinc-300 hover:bg-zinc-700/80'
                  }`}
                >
                  {c.display_name}
                </button>
              ))}
            </div>
          )}
        </div>
        <span className="text-xs text-zinc-500 hidden sm:inline">
          /workspaces/{activeWorkspace}
        </span>
      </div>

      {/* Iframe - offset for workspace bar */}
      <iframe
        key={activeWorkspace}
        src={iframeSrc}
        className="fixed left-0 md:left-[240px] right-0 bottom-0 border-0 z-10"
        style={{ top: 'calc(3.5rem + 40px)', width: undefined }}
        title={`Claude Code — ${activeLabel}`}
        allow="clipboard-read; clipboard-write"
      />
    </>
  );
};

export default CodePanel;
