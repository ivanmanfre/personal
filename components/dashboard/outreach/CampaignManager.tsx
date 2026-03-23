import React, { useState } from 'react';
import { Plus, Trash2, Upload, ChevronDown, ChevronRight } from 'lucide-react';
import PanelCard from '../shared/PanelCard';
import type { OutreachCampaign } from '../../../types/dashboard';

interface Props {
  campaigns: OutreachCampaign[];
  onToggle: (id: string, isActive: boolean) => void;
  onUpdate: (id: string, field: string, value: string) => void;
  onCreate: (name: string, description: string, nicheTags: string[], apolloFilters: Record<string, any>) => void;
  onDelete: (id: string) => void;
  onImport: (campaignId: string) => void;
}

export const CampaignManager: React.FC<Props> = ({ campaigns, onToggle, onUpdate, onCreate, onDelete, onImport }) => {
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newTags, setNewTags] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleCreate = () => {
    if (!newName.trim()) return;
    onCreate(
      newName.trim(),
      newDesc.trim(),
      newTags.split(',').map((t) => t.trim()).filter(Boolean),
      {}
    );
    setNewName('');
    setNewDesc('');
    setNewTags('');
    setShowCreate(false);
  };

  return (
    <PanelCard
      title="Campaigns"
      headerRight={
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-colors"
        >
          <Plus className="w-3 h-3" /> New
        </button>
      }
    >
      {/* Create form */}
      {showCreate && (
        <div className="bg-zinc-800/40 border border-zinc-700/40 rounded-xl p-3 mb-3 space-y-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Campaign name..."
            className="w-full px-3 py-1.5 bg-zinc-800/60 border border-zinc-700/40 rounded-lg text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-purple-500/40"
            autoFocus
          />
          <input
            type="text"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Description (optional)..."
            className="w-full px-3 py-1.5 bg-zinc-800/60 border border-zinc-700/40 rounded-lg text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
          />
          <input
            type="text"
            value={newTags}
            onChange={(e) => setNewTags(e.target.value)}
            placeholder="Tags (comma separated): ai, agency, automation..."
            className="w-full px-3 py-1.5 bg-zinc-800/60 border border-zinc-700/40 rounded-lg text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
          />
          <div className="flex gap-2">
            <button onClick={handleCreate} className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-colors">Create</button>
            <button onClick={() => setShowCreate(false)} className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {/* Campaign list */}
      {campaigns.length === 0 ? (
        <p className="text-xs text-zinc-600 text-center py-4">No campaigns yet. Create one to start importing prospects.</p>
      ) : (
        <div className="space-y-2">
          {campaigns.map((c) => {
            const replyRate = c.connectedCount > 0 ? Math.round((c.repliedCount / c.connectedCount) * 100) : 0;
            return (
              <div key={c.id} className="bg-zinc-800/40 border border-zinc-700/40 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setExpandedId(expandedId === c.id ? null : c.id)} className="text-zinc-500 hover:text-zinc-300">
                      {expandedId === c.id ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                    <span className="text-sm font-medium text-zinc-200">{c.name}</span>
                    {!c.isActive && <span className="text-[9px] text-zinc-600 uppercase">paused</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onToggle(c.id, !c.isActive)}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${
                        c.isActive
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
                          : 'bg-zinc-600/15 text-zinc-500 border-zinc-600/20'
                      }`}
                    >
                      {c.isActive ? 'ON' : 'OFF'}
                    </button>
                  </div>
                </div>

                {/* Tags */}
                {c.nicheTags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {c.nicheTags.map((t, i) => (
                      <span key={i} className="px-1.5 py-0.5 rounded-full text-[9px] bg-purple-500/10 text-purple-400 border border-purple-500/15">{t}</span>
                    ))}
                  </div>
                )}

                {/* Stats row */}
                <div className="flex gap-3 mt-2 text-[11px] text-zinc-500">
                  <span>Prospects: <span className="text-zinc-300">{c.prospectCount}</span></span>
                  <span>Connected: <span className="text-zinc-300">{c.connectedCount}</span></span>
                  <span>Replied: <span className="text-zinc-300">{c.repliedCount}</span></span>
                  <span>Rate: <span className="text-zinc-300">{replyRate}%</span></span>
                </div>

                {/* Expanded details */}
                {expandedId === c.id && (
                  <div className="mt-3 pt-3 border-t border-zinc-700/30 space-y-2">
                    <div className="flex gap-3 text-[11px] text-zinc-500">
                      <span>Warmup: {c.warmupDays}d</span>
                      <span>Max: {c.maxProspects}</span>
                      {c.lastImportAt && <span>Last import: {new Date(c.lastImportAt).toLocaleDateString()}</span>}
                    </div>
                    {c.description && <p className="text-xs text-zinc-500">{c.description}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={() => onImport(c.id)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
                      >
                        <Upload className="w-3 h-3" /> Import Prospects
                      </button>
                      <button
                        onClick={() => { if (window.confirm(`Delete campaign "${c.name}"? All its prospects will be archived.`)) onDelete(c.id); }}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </PanelCard>
  );
};
