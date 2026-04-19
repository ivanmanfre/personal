import React, { useState, useMemo, useCallback } from 'react';
import { Film, Plus, Trash2, ChevronDown, ChevronRight, Monitor, Camera, Wrench, LayoutGrid, Linkedin, Instagram, Youtube, Sparkles, Play, Loader2, ExternalLink, AlertCircle, Save, DollarSign, Video, CheckCircle2, Circle as CircleIcon, RotateCcw } from 'lucide-react';
import { useVideoIdeas } from '../../hooks/useVideoIdeas';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import VideoRecorder from './VideoRecorder';
import VideoEditingView from './VideoEditingView';
import StatCard from './shared/StatCard';
import LoadingSkeleton from './shared/LoadingSkeleton';
import RefreshIndicator from './shared/RefreshIndicator';
import EmptyState from './shared/EmptyState';
import PanelCard from './shared/PanelCard';
import type { VideoIdea } from '../../types/dashboard';

const statusFlow = ['idea', 'scripted', 'recording', 'editing', 'published'] as const;

const statusColors: Record<string, string> = {
  idea: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  scripted: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  recording: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  editing: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  published: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};

const renderStatusLabels: Record<string, string> = {
  generating_script: 'Generating script...',
  generating_audio: 'Generating voiceover...',
  generating_avatar: 'Generating avatar clips...',
  rendering: 'Rendering video...',
  uploading: 'Uploading...',
  done: 'Complete',
  error: 'Error',
};

const typeIcons: Record<string, React.ReactNode> = {
  carousel_animation: <LayoutGrid className="w-3.5 h-3.5" />,
  screen_recording: <Monitor className="w-3.5 h-3.5" />,
  talking_head: <Camera className="w-3.5 h-3.5" />,
  tool_teardown: <Wrench className="w-3.5 h-3.5" />,
  system_tour: <LayoutGrid className="w-3.5 h-3.5" />,
};

const typeLabels: Record<string, string> = {
  carousel_animation: 'Carousel',
  screen_recording: 'Screen Recording',
  talking_head: 'Talking Head',
  tool_teardown: 'Tool Teardown',
  system_tour: 'System Tour',
};

const platformIcons: Record<string, React.ReactNode> = {
  linkedin: <Linkedin className="w-3.5 h-3.5" />,
  instagram: <Instagram className="w-3.5 h-3.5" />,
  youtube: <Youtube className="w-3.5 h-3.5" />,
  multi: <Film className="w-3.5 h-3.5" />,
};

const priorityColors: Record<string, string> = {
  high: 'text-red-400',
  medium: 'text-amber-400',
  low: 'text-zinc-500',
};

function RenderStatusBadge({ status, error }: { status: string | null; error: string | null }) {
  if (!status) return null;
  const isActive = status !== 'done' && status !== 'error';
  const isError = status === 'error';
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full border font-medium ${
      isError ? 'bg-red-500/20 text-red-400 border-red-500/30' :
      isActive ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' :
      'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    }`} title={isError && error ? error : undefined}>
      {isActive && <Loader2 className="w-3 h-3 animate-spin" />}
      {isError && <AlertCircle className="w-3 h-3" />}
      {renderStatusLabels[status] || status}
    </span>
  );
}

function ScriptEditor({ idea, onSave }: { idea: VideoIdea; onSave: (script: string) => void }) {
  const [text, setText] = useState(idea.script || '');
  const [dirty, setDirty] = useState(false);

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Script</p>
      <textarea
        value={text}
        onChange={e => { setText(e.target.value); setDirty(true); }}
        rows={6}
        className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-blue-500/50 resize-y"
        placeholder="Write or generate a narration script..."
      />
      {dirty && (
        <button
          onClick={() => { onSave(text); setDirty(false); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 transition-colors"
        >
          <Save className="w-3 h-3" /> Save Script
        </button>
      )}
    </div>
  );
}

function AvatarProgressDisplay({ idea }: { idea: VideoIdea }) {
  const progress = idea.renderProgress;
  if (!progress) return null;

  const stepIcons: Record<string, React.ReactNode> = {
    done: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
    processing: <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />,
    pending: <CircleIcon className="w-3.5 h-3.5 text-zinc-600" />,
    error: <AlertCircle className="w-3.5 h-3.5 text-red-400" />,
  };

  return (
    <div className="space-y-3">
      {/* Steps timeline */}
      <div className="space-y-1.5">
        {progress.steps.map((step, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            {stepIcons[step.status] || stepIcons.pending}
            <span className={step.status === 'processing' ? 'text-cyan-400 font-medium' : step.status === 'done' ? 'text-zinc-400' : 'text-zinc-600'}>
              {step.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </span>
            {step.detail && <span className="text-zinc-600">({step.detail})</span>}
          </div>
        ))}
      </div>

      {/* Cost tracking */}
      <div className="flex items-center gap-3 text-[10px] text-zinc-500">
        <span className="flex items-center gap-1">
          <DollarSign className="w-3 h-3" />
          Cost: ${progress.actualCost?.toFixed(2) || '0.00'} / ~${progress.estimatedCost?.toFixed(2) || '0.00'}
        </span>
        <span>Chunks: {progress.completedChunks}/{progress.totalChunks}</span>
      </div>

      {/* Chunk details (collapsed by default, expandable) */}
      {progress.chunkDetails && progress.chunkDetails.length > 0 && (
        <details className="text-[10px]">
          <summary className="text-zinc-500 cursor-pointer hover:text-zinc-400">Chunk details</summary>
          <div className="mt-1 space-y-0.5 pl-2">
            {progress.chunkDetails.map((chunk, i) => (
              <div key={i} className="flex items-center gap-2">
                {stepIcons[chunk.status] || stepIcons.pending}
                <span className="text-zinc-500">Chunk {chunk.index + 1}</span>
                {chunk.durationSeconds && <span className="text-zinc-600">{Math.round(chunk.durationSeconds)}s</span>}
                {chunk.cost && <span className="text-zinc-600">${chunk.cost.toFixed(2)}</span>}
                {chunk.videoUrl && (
                  <a href={chunk.videoUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

const VideoIdeasPanel: React.FC = () => {
  const [filter, setFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState('carousel_animation');
  const [newPlatform, setNewPlatform] = useState('linkedin');
  const { ideas, statusCounts, loading, refresh, updateIdea, createIdea, deleteIdea, generateScript, generateVideo, uploadRecording, generateAvatarVideo, estimateAvatarCost } = useVideoIdeas();
  const { lastRefreshed } = useAutoRefresh(refresh, { realtimeTables: ['video_ideas'] });

  // Dedupe on title+videoType+platform. Source of truth is still the raw `ideas`
  // array (so statusCounts stay accurate); we only collapse for display.
  const dedupedIdeas = useMemo(() => {
    const seen = new Map<string, { idea: VideoIdea; dupeIds: string[] }>();
    // `ideas` is sorted created_at desc, so the first match we keep is the most recent
    for (const idea of ideas) {
      const key = `${idea.title}|${idea.videoType}|${idea.platform}`.toLowerCase();
      const existing = seen.get(key);
      if (existing) {
        existing.dupeIds.push(idea.id);
      } else {
        seen.set(key, { idea, dupeIds: [] });
      }
    }
    return Array.from(seen.values());
  }, [ideas]);

  const filteredIdeas = useMemo(() => {
    const base = filter === 'all' ? dedupedIdeas : dedupedIdeas.filter(({ idea }) => idea.status === filter);
    return base;
  }, [dedupedIdeas, filter]);

  const handleDeleteDuplicates = useCallback(async (dupeIds: string[]) => {
    if (!window.confirm(`Delete ${dupeIds.length} duplicate idea${dupeIds.length > 1 ? 's' : ''}? The most recent one is kept.`)) return;
    await Promise.all(dupeIds.map((id) => deleteIdea(id)));
  }, [deleteIdea]);

  const handleCreate = useCallback(async () => {
    if (!newTitle.trim()) return;
    await createIdea(newTitle.trim(), newType, newPlatform);
    setNewTitle('');
    setShowCreate(false);
  }, [newTitle, newType, newPlatform, createIdea]);

  const advanceStatus = useCallback((id: string, currentStatus: string) => {
    const idx = statusFlow.indexOf(currentStatus as typeof statusFlow[number]);
    if (idx < statusFlow.length - 1) {
      updateIdea(id, 'status', statusFlow[idx + 1]);
    }
  }, [updateIdea]);

  if (loading) return <LoadingSkeleton cards={4} rows={5} />;

  const total = ideas.length;
  const hasActiveRender = ideas.some(i => i.renderStatus && i.renderStatus !== 'done' && i.renderStatus !== 'error');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Video Ideas</h1>
          {hasActiveRender && (
            <span className="inline-flex items-center gap-1.5 text-xs text-cyan-400">
              <Loader2 className="w-4 h-4 animate-spin" /> Processing
            </span>
          )}
        </div>
        <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refresh} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label="Total" value={total} icon={<Film className="w-5 h-5" />} color="text-blue-400" />
        <StatCard label="Ideas" value={statusCounts['idea'] || 0} icon={<Film className="w-5 h-5" />} color="text-blue-400" />
        <StatCard label="Scripted" value={statusCounts['scripted'] || 0} icon={<Sparkles className="w-5 h-5" />} color="text-violet-400" />
        <StatCard label="In Progress" value={(statusCounts['recording'] || 0) + (statusCounts['editing'] || 0)} icon={<Camera className="w-5 h-5" />} color="text-amber-400" />
        <StatCard label="Published" value={statusCounts['published'] || 0} icon={<Film className="w-5 h-5" />} color="text-emerald-400" />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {['all', ...statusFlow].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              filter === s
                ? 'bg-zinc-700 text-white border-zinc-600'
                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-300'
            }`}
          >
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            {s !== 'all' && statusCounts[s] ? ` (${statusCounts[s]})` : ''}
          </button>
        ))}
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> New Idea
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-xl p-4 space-y-3">
          <input
            type="text"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="Video idea title..."
            className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500/50"
            autoFocus
          />
          <div className="flex items-center gap-3">
            <select value={newType} onChange={e => setNewType(e.target.value)} className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-blue-500/50">
              {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={newPlatform} onChange={e => setNewPlatform(e.target.value)} className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-blue-500/50">
              <option value="linkedin">LinkedIn</option>
              <option value="instagram">Instagram</option>
              <option value="youtube">YouTube</option>
              <option value="multi">Multi-platform</option>
            </select>
            <button onClick={handleCreate} disabled={!newTitle.trim()} className="px-4 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              Create
            </button>
          </div>
        </div>
      )}

      {/* Ideas list */}
      {ideas.length === 0 ? (
        <EmptyState title="No video ideas yet" description="Create your first video idea to start planning content." icon={<Film className="w-10 h-10" />} />
      ) : (
        <PanelCard title="Video Ideas" icon={<Film className="w-4 h-4" />} badge={filteredIdeas.length} accent="blue" scrollable>
          <div className="divide-y divide-zinc-800/40">
            {filteredIdeas.map(({ idea, dupeIds }) => {
              const isExpanded = expandedId === idea.id;
              const statusIdx = statusFlow.indexOf(idea.status as typeof statusFlow[number]);
              const canAdvance = statusIdx >= 0 && statusIdx < statusFlow.length - 1;
              const isRendering = idea.renderStatus && idea.renderStatus !== 'done' && idea.renderStatus !== 'error';
              const canGenerateScript = idea.status === 'idea' && !isRendering;
              const canGenerateVideo = idea.status === 'scripted' && idea.script && !isRendering;

              return (
                <div key={idea.id} className="group/item px-4 py-3 hover:bg-zinc-800/20 transition-colors">
                  <div className="flex items-start gap-3">
                    <button onClick={() => setExpandedId(isExpanded ? null : idea.id)} className="mt-0.5 text-zinc-500 hover:text-zinc-300 transition-colors">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white text-sm truncate">{idea.title}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className={`inline-flex items-center text-[10px] px-2 py-0.5 rounded-full border font-medium ${statusColors[idea.status] || statusColors.idea}`}>
                          {idea.status}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500">
                          {typeIcons[idea.videoType]} {typeLabels[idea.videoType] || idea.videoType}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500">
                          {platformIcons[idea.platform]} {idea.platform}
                        </span>
                        {idea.priority && <span className={`text-[10px] font-medium ${priorityColors[idea.priority] || 'text-zinc-500'}`}>{idea.priority}</span>}
                        <RenderStatusBadge status={idea.renderStatus} error={idea.renderError} />
                        {dupeIds.length > 0 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteDuplicates(dupeIds); }}
                            className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
                            title={`${dupeIds.length} older duplicate${dupeIds.length > 1 ? 's' : ''} of this idea — click to delete them`}
                          >
                            ×{dupeIds.length + 1} dupes
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Generate Script */}
                      {canGenerateScript && (
                        <button
                          onClick={() => generateScript(idea.id)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium bg-violet-600/20 text-violet-400 border border-violet-500/30 hover:bg-violet-600/30 transition-colors"
                        >
                          <Sparkles className="w-3 h-3" /> Script
                        </button>
                      )}
                      {/* Generate Video */}
                      {canGenerateVideo && (
                        <button
                          onClick={() => generateVideo(idea.id)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30 transition-colors"
                        >
                          <Play className="w-3 h-3" /> Video
                        </button>
                      )}
                      {/* View Video */}
                      {idea.videoUrl && (
                        <a
                          href={idea.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" /> View
                        </a>
                      )}
                      {/* Status advance + delete (on hover) */}
                      <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                        {canAdvance && !isRendering && (
                          <button onClick={() => advanceStatus(idea.id, idea.status)} className="px-2 py-1 rounded text-[10px] font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors" title={`Move to ${statusFlow[statusIdx + 1]}`}>
                            {statusFlow[statusIdx + 1]}
                          </button>
                        )}
                        <button onClick={() => deleteIdea(idea.id)} className="p-1.5 rounded bg-zinc-800 hover:bg-red-900/50 text-zinc-500 hover:text-red-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="mt-3 ml-7 space-y-3">
                      {idea.description && (
                        <div>
                          <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-1">Description</p>
                          <p className="text-xs text-zinc-400">{idea.description}</p>
                        </div>
                      )}

                      {/* Script editor */}
                      <ScriptEditor idea={idea} onSave={(script) => updateIdea(idea.id, 'script', script)} />

                      {/* Generate Avatar Video */}
                      {idea.status === 'scripted' && idea.script && !isRendering && (
                        <div className="space-y-2">
                          {(() => {
                            const est = estimateAvatarCost(idea.script || '');
                            return (
                              <div>
                                <button
                                  onClick={() => {
                                    if (window.confirm(`This will cost approximately $${est.estimatedCost} in HeyGen credits (${est.chunks} chunk${est.chunks > 1 ? 's' : ''} × ~$4/min). Continue?`)) {
                                      generateAvatarVideo(idea.id);
                                    }
                                  }}
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium bg-purple-600/20 text-purple-400 border border-purple-500/30 hover:bg-purple-600/30 transition-colors"
                                >
                                  <Video className="w-3 h-3" /> Avatar Video
                                </button>
                                <p className="text-[10px] text-zinc-600 mt-1">
                                  ~{est.estimatedMinutes} min · {est.chunks} chunk{est.chunks > 1 ? 's' : ''} · ~${est.estimatedCost} HeyGen
                                </p>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* Avatar generation progress */}
                      {idea.renderProgress && (
                        <AvatarProgressDisplay idea={idea} />
                      )}

                      {/* Recording */}
                      {(idea.status === 'idea' || idea.status === 'scripted') && !idea.recordingPath && (
                        <div>
                          <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-2">Record</p>
                          <VideoRecorder onRecordingComplete={async (file) => {
                            await uploadRecording(idea.id, file);
                          }} />
                        </div>
                      )}

                      {/* Recording processing */}
                      {idea.status === 'recording' && (
                        <div className="flex items-center gap-2 text-xs text-cyan-400">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing recording...
                        </div>
                      )}

                      {/* Editing view */}
                      {(idea.status === 'editing' || (idea.recordingPath && idea.transcriptWords)) && (
                        <VideoEditingView idea={idea} />
                      )}

                      {/* Render error */}
                      {idea.renderStatus === 'error' && idea.renderError && (
                        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3">
                          <p className="text-xs text-red-400"><AlertCircle className="w-3.5 h-3.5 inline mr-1.5" />{idea.renderError}</p>
                        </div>
                      )}

                      {idea.tags && idea.tags.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {idea.tags.map((tag, i) => (
                            <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800/50 text-zinc-500 border border-zinc-800/60">{tag}</span>
                          ))}
                        </div>
                      )}

                      {/* Carousel source link */}
                      {idea.carouselFolderId && (
                        <a href={`https://drive.google.com/drive/folders/${idea.carouselFolderId}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[10px] text-blue-400 hover:text-blue-300">
                          <ExternalLink className="w-3 h-3" /> View source slides
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </PanelCard>
      )}
    </div>
  );
};

export default VideoIdeasPanel;
