import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { Video, Upload, Eye, Share2, Clock, HardDrive, Trash2, Link, Loader2, AlertCircle, Play, Scissors, Circle, Square, Mic, MicOff, Monitor } from 'lucide-react';
import { useRecordings } from '../../hooks/useRecordings';
import { useDashboard } from '../../contexts/DashboardContext';
import TrimEditor from './TrimEditor';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { supabase } from '../../lib/supabase';
import StatCard from './shared/StatCard';
import FilterBar from './shared/FilterBar';
import RefreshIndicator from './shared/RefreshIndicator';
import LoadingSkeleton from './shared/LoadingSkeleton';
import EmptyState from './shared/EmptyState';
import AnimateIn from './shared/AnimateIn';
import { timeAgo, formatDate, formatTime } from './shared/utils';
import type { Recording } from '../../types/dashboard';

function formatDuration(seconds: number | null): string {
  if (!seconds) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '0 B';
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
}

const statusColors: Record<string, string> = {
  uploading: 'bg-blue-500/20 text-blue-400',
  uploaded: 'bg-blue-500/20 text-blue-400',
  processing: 'bg-amber-500/20 text-amber-400',
  ready: 'bg-emerald-500/20 text-emerald-400',
  editing: 'bg-violet-500/20 text-violet-400',
  're-rendering': 'bg-amber-500/20 text-amber-400',
  error: 'bg-red-500/20 text-red-400',
};

const RecordingsPanel: React.FC = () => {
  const {
    recordings, stats, loading, mutating, refresh,
    updateTitle, createShare, deleteRecording, uploadRecording, extendExpiry, archiveRecording,
  } = useRecordings();
  const { lastRefreshed } = useAutoRefresh(refresh, { realtimeTables: ['recordings'] });
  const { userTimezone } = useDashboard();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [uploading, setUploading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Screen Recording State ───
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [withMic, setWithMic] = useState(true);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (previewRef.current && previewStream) {
      previewRef.current.srcObject = previewStream;
    }
  }, [previewStream]);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    previewStream?.getTracks().forEach((t) => t.stop());
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: true,
      });

      let combinedStream = screenStream;

      if (withMic) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const ctx = new AudioContext();
          const dest = ctx.createMediaStreamDestination();
          // Mix system audio (if available) + mic
          const systemAudio = screenStream.getAudioTracks();
          if (systemAudio.length > 0) {
            ctx.createMediaStreamSource(new MediaStream(systemAudio)).connect(dest);
          }
          ctx.createMediaStreamSource(micStream).connect(dest);
          combinedStream = new MediaStream([
            ...screenStream.getVideoTracks(),
            ...dest.stream.getAudioTracks(),
          ]);
        } catch {
          // Mic denied — continue with screen only
        }
      }

      setPreviewStream(combinedStream);
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm';

      const recorder = new MediaRecorder(combinedStream, { mimeType, videoBitsPerSecond: 3_000_000 });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        combinedStream.getTracks().forEach((t) => t.stop());
        setPreviewStream(null);
        setIsRecording(false);

        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size < 1000) return; // too small, user cancelled immediately

        const now = new Date();
        const title = `Recording ${formatDate(now, {}, userTimezone)} ${formatTime(now, { hour: '2-digit', minute: '2-digit' }, userTimezone)}`;
        const ext = mimeType.includes('webm') ? 'webm' : 'mp4';
        const file = new File([blob], `recording.${ext}`, { type: mimeType.split(';')[0] });

        setUploading(true);
        await uploadRecording(file, title);
        setUploading(false);
        setRecordingTime(0);
      };

      // Stop recording when user stops screen share
      screenStream.getVideoTracks()[0].onended = () => {
        if (recorder.state === 'recording') recorder.stop();
      };

      recorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch {
      // User cancelled the screen picker
    }
  }, [withMic, uploadRecording]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const filtered = useMemo(() => {
    let list = recordings;
    if (statusFilter !== 'all') list = list.filter((r) => r.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((r) => r.title.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q));
    }
    return list;
  }, [recordings, statusFilter, search]);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const title = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
    await uploadRecording(file, title);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [uploadRecording]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('video/')) return;
    setUploading(true);
    const title = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
    await uploadRecording(file, title);
    setUploading(false);
  }, [uploadRecording]);

  const handleTitleSave = useCallback(async (id: string) => {
    if (editTitle.trim()) await updateTitle(id, editTitle.trim());
    setEditingTitleId(null);
  }, [editTitle, updateTitle]);

  const selected = selectedId ? recordings.find((r) => r.id === selectedId) : null;

  if (loading) return <LoadingSkeleton cards={4} rows={6} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-zinc-100">Screen Recordings</h1>
          <span className="text-xs text-zinc-500">{stats.total} recordings</span>
        </div>
        <div className="flex items-center gap-3">
          <RefreshIndicator lastRefreshed={lastRefreshed} />
          <button
            onClick={() => setWithMic((m) => !m)}
            className={`p-1.5 rounded-lg transition-colors ${withMic ? 'bg-emerald-600/20 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}
            title={withMic ? 'Mic on' : 'Mic off'}
          >
            {withMic ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
          </button>
          {isRecording ? (
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded-lg text-xs font-medium text-white transition-colors animate-pulse"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              Stop {formatDuration(recordingTime)}
            </button>
          ) : (
            <button
              onClick={startRecording}
              disabled={uploading}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded-lg text-xs font-medium text-white transition-colors"
            >
              <Circle className="w-3.5 h-3.5 fill-current" />
              Record
            </button>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || isRecording}
            className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded-lg text-xs font-medium text-zinc-300 transition-colors"
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
          <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={handleUpload} />
        </div>
      </div>

      {/* Recording Preview */}
      {previewStream && (
        <div className="relative bg-black rounded-xl overflow-hidden border border-red-500/30">
          <video ref={previewRef} autoPlay muted playsInline className="w-full max-h-64 object-contain" />
          <div className="absolute top-3 left-3 flex items-center gap-2 px-2.5 py-1 bg-red-600/90 backdrop-blur-sm rounded-full">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span className="text-xs font-mono text-white">{formatDuration(recordingTime)}</span>
          </div>
          <div className="absolute top-3 right-3 flex items-center gap-2">
            <button
              onClick={stopRecording}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded-lg text-xs font-medium text-white transition-colors"
            >
              <Square className="w-3 h-3 fill-current" />
              Stop Recording
            </button>
          </div>
        </div>
      )}

      {/* Stat Cards */}
      <AnimateIn>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <StatCard label="Total" value={stats.total} icon={<Video className="w-4 h-4" />} color="text-blue-400" />
          <StatCard label="Processing" value={stats.processing} icon={<Loader2 className="w-4 h-4" />} color="text-amber-400" />
          <StatCard label="Shared" value={stats.shared} icon={<Share2 className="w-4 h-4" />} color="text-emerald-400" />
          <StatCard label="Total Views" value={stats.totalViews} icon={<Eye className="w-4 h-4" />} color="text-violet-400" />
          <StatCard label="Storage" value={formatBytes(stats.totalSizeBytes)} icon={<HardDrive className="w-4 h-4" />} color="text-cyan-400" />
        </div>
      </AnimateIn>

      {/* Filter Bar */}
      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search recordings..."
        filters={[
          { label: 'All', value: 'all', active: statusFilter === 'all', onClick: () => setStatusFilter('all') },
          { label: 'Ready', value: 'ready', active: statusFilter === 'ready', onClick: () => setStatusFilter('ready') },
          { label: 'Processing', value: 'processing', active: statusFilter === 'processing', onClick: () => setStatusFilter('processing') },
          { label: 'Shared', value: 'shared', active: statusFilter === 'shared', onClick: () => setStatusFilter('shared') },
        ]}
      />

      {/* Drop Zone + Grid */}
      {filtered.length === 0 && !uploading ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="border-2 border-dashed border-zinc-700/60 rounded-2xl p-16 text-center cursor-pointer hover:border-zinc-600/80 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <EmptyState
            title="No recordings yet"
            description="Upload a video or drag & drop here. Recordings from the Tauri app will appear automatically."
            icon={<Video className="w-10 h-10" />}
          />
        </div>
      ) : (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          {/* Detail View */}
          {selected && (
            <AnimateIn>
              <RecordingDetailView
                recording={selected}
                onClose={() => setSelectedId(null)}
                onShare={() => createShare(selected.id)}
                onDelete={() => { deleteRecording(selected.id); setSelectedId(null); }}
                onExtend={() => extendExpiry(selected.id)}
                onArchive={() => archiveRecording(selected.id)}
                isMutating={mutating.has(selected.id)}
              />
            </AnimateIn>
          )}

          {/* Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((rec, i) => (
              <AnimateIn key={rec.id} delay={i * 40}>
                <RecordingCard
                  recording={rec}
                  isSelected={rec.id === selectedId}
                  isMutating={mutating.has(rec.id)}
                  isEditingTitle={editingTitleId === rec.id}
                  editTitle={editingTitleId === rec.id ? editTitle : ''}
                  onSelect={() => setSelectedId(selectedId === rec.id ? null : rec.id)}
                  onShare={() => createShare(rec.id)}
                  onDelete={() => deleteRecording(rec.id)}
                  onStartEditTitle={() => { setEditingTitleId(rec.id); setEditTitle(rec.title); }}
                  onEditTitleChange={setEditTitle}
                  onSaveTitle={() => handleTitleSave(rec.id)}
                  onCancelEditTitle={() => setEditingTitleId(null)}
                />
              </AnimateIn>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Recording Card ───

interface RecordingCardProps {
  recording: Recording;
  isSelected: boolean;
  isMutating: boolean;
  isEditingTitle: boolean;
  editTitle: string;
  onSelect: () => void;
  onShare: () => void;
  onDelete: () => void;
  onStartEditTitle: () => void;
  onEditTitleChange: (v: string) => void;
  onSaveTitle: () => void;
  onCancelEditTitle: () => void;
}

const RecordingCard: React.FC<RecordingCardProps> = ({
  recording: rec, isSelected, isMutating, isEditingTitle, editTitle,
  onSelect, onShare, onDelete, onStartEditTitle, onEditTitleChange, onSaveTitle, onCancelEditTitle,
}) => {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  React.useEffect(() => {
    if (!rec.thumbnailPath) return;
    supabase.storage.from('recordings').createSignedUrl(rec.thumbnailPath, 3600)
      .then(({ data }) => { if (data?.signedUrl) setThumbUrl(data.signedUrl); });
  }, [rec.thumbnailPath]);

  const statusClass = statusColors[rec.status] || 'bg-zinc-500/20 text-zinc-400';

  return (
    <div
      onClick={onSelect}
      className={`group relative bg-zinc-900/90 border rounded-xl overflow-hidden cursor-pointer transition-all duration-200 hover:border-zinc-600/80 hover:shadow-lg hover:shadow-black/20 ${
        isSelected ? 'border-emerald-500/50 ring-1 ring-emerald-500/20' : 'border-zinc-800/60'
      } ${isMutating ? 'opacity-60 pointer-events-none' : ''}`}
    >
      {/* Thumbnail / Placeholder */}
      <div className="relative aspect-video bg-zinc-800/50">
        {thumbUrl ? (
          <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
        ) : (() => {
            // Stable hue from the recording id so each placeholder keeps the same
            // color; gives the grid some visual variety and makes recordings
            // recognizable by color even without a real poster frame.
            let h = 0;
            for (let i = 0; i < rec.id.length; i++) h = (h * 31 + rec.id.charCodeAt(i)) >>> 0;
            const hue = h % 360;
            const label = (rec.title?.trim() || `Recording ${new Date(rec.createdAt).toLocaleDateString()}`).slice(0, 36);
            return (
              <div
                className="w-full h-full flex flex-col items-center justify-center p-3 text-center"
                style={{ background: `linear-gradient(135deg, hsl(${hue} 40% 18%), hsl(${(hue + 30) % 360} 30% 12%))` }}
              >
                <Video className="w-6 h-6 opacity-60 mb-2" style={{ color: `hsl(${hue} 70% 75%)` }} />
                <span className="text-[11px] font-medium text-zinc-200 leading-tight line-clamp-2">{label}</span>
              </div>
            );
          })()}
        {/* Duration badge */}
        {rec.durationSeconds && (
          <span className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/70 backdrop-blur-sm rounded text-[10px] font-mono text-zinc-300">
            {formatDuration(rec.durationSeconds)}
          </span>
        )}
        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
          <Play className="w-10 h-10 text-white/80" />
        </div>
        {/* Status */}
        <span className={`absolute top-2 left-2 px-1.5 py-0.5 rounded text-[10px] font-medium ${statusClass}`}>
          {rec.status}
        </span>
        {/* Processing error indicator */}
        {rec.processingError && (
          <span className="absolute top-2 right-2" title={rec.processingError}>
            <AlertCircle className="w-4 h-4 text-amber-400" />
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-2">
        {isEditingTitle ? (
          <input
            autoFocus
            value={editTitle}
            onChange={(e) => onEditTitleChange(e.target.value)}
            onBlur={onSaveTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSaveTitle();
              if (e.key === 'Escape') onCancelEditTitle();
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
          />
        ) : (
          <h3
            className="text-sm font-medium text-zinc-200 truncate cursor-text hover:text-white"
            onDoubleClick={(e) => { e.stopPropagation(); onStartEditTitle(); }}
            title="Double-click to edit"
          >
            {rec.title}
          </h3>
        )}

        <div className="flex items-center justify-between text-[11px] text-zinc-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {timeAgo(rec.createdAt)}
            </span>
            {rec.fileSizeBytes && (
              <span>{formatBytes(rec.fileSizeBytes)}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {rec.isPublic && (
              <span className="flex items-center gap-1 text-emerald-400">
                <Eye className="w-3 h-3" />
                {rec.viewCount}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onShare(); }}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-[11px] text-zinc-400 hover:text-white transition-colors"
            title="Copy share link"
          >
            <Link className="w-3 h-3" />
            Share
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-800 hover:bg-red-900/50 text-[11px] text-zinc-400 hover:text-red-400 transition-colors"
            title="Delete recording"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Detail View (Inline Expanded) ───

interface DetailProps {
  recording: Recording;
  onClose: () => void;
  onShare: () => void;
  onDelete: () => void;
  onExtend: () => void;
  onArchive: () => void;
  isMutating: boolean;
}

const RecordingDetailView: React.FC<DetailProps> = ({ recording: rec, onClose, onShare, onDelete, onExtend, onArchive, isMutating }) => {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    const path = rec.processedPath || rec.originalPath;
    supabase.storage.from('recordings').createSignedUrl(path, 3600)
      .then(({ data }) => { if (data?.signedUrl) setVideoUrl(data.signedUrl); });
  }, [rec.processedPath, rec.originalPath]);

  return (
    <div className="mb-6 bg-zinc-900/90 border border-zinc-800/60 rounded-2xl overflow-hidden">
      {/* Video Player */}
      <div className="relative bg-black aspect-video">
        {videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            playsInline
            className="w-full h-full"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-zinc-600 animate-spin" />
          </div>
        )}
      </div>

      {/* Info Bar */}
      <div className="p-4 border-t border-zinc-800/40">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">{rec.title}</h2>
            <p className="text-xs text-zinc-500 mt-1">
              {formatDuration(rec.durationSeconds)} &middot; {formatBytes(rec.fileSizeBytes)} &middot; {timeAgo(rec.createdAt)}
              {rec.isPublic && ` · ${rec.viewCount} views`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {rec.durationSeconds && rec.durationSeconds > 0 && (
              <button
                onClick={() => setShowEditor(!showEditor)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  showEditor
                    ? 'bg-violet-600 hover:bg-violet-500 text-white'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                }`}
              >
                <Scissors className="w-3.5 h-3.5" />
                Edit
              </button>
            )}
            <button
              disabled={isMutating}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg text-xs font-medium text-white transition-colors"
              onClick={onShare}
            >
              <Share2 className="w-3.5 h-3.5" />
              Share
            </button>
            {rec.shareToken && (
              <span className="text-[11px] text-zinc-500">
                Expires {rec.shareExpiresAt ? timeAgo(rec.shareExpiresAt) : 'never'}
              </span>
            )}
            <button
              onClick={onDelete}
              disabled={isMutating}
              className="p-1.5 rounded-lg hover:bg-red-900/30 text-zinc-500 hover:text-red-400 transition-colors disabled:opacity-50"
              title="Delete recording"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Processing error */}
        {rec.processingError && (
          <div className="mt-3 flex items-start gap-2 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-300">{rec.processingError}</p>
          </div>
        )}

        {/* Trim Editor */}
        {showEditor && rec.durationSeconds && videoUrl && (
          <div className="mt-4 p-4 bg-zinc-800/20 border border-zinc-700/30 rounded-xl">
            <TrimEditor
              recordingId={rec.id}
              videoUrl={videoUrl}
              duration={rec.durationSeconds}
              videoRef={videoRef}
              onTrimComplete={() => { setShowEditor(false); }}
              onCancel={() => setShowEditor(false)}
            />
          </div>
        )}

        {/* Lifecycle Controls (Phase 6) */}
        {rec.expiresAt && (
          <div className="mt-3 flex items-center justify-between p-2.5 bg-zinc-800/30 border border-zinc-700/30 rounded-lg">
            <span className="text-[11px] text-zinc-500">
              {new Date(rec.expiresAt) < new Date() ? (
                <span className="text-red-400">Expired</span>
              ) : (
                <>Expires {timeAgo(rec.expiresAt)}</>
              )}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={onExtend}
                disabled={isMutating}
                className="px-2 py-1 rounded-md bg-zinc-700/50 hover:bg-zinc-700 text-[11px] text-zinc-300 hover:text-white transition-colors disabled:opacity-40"
              >
                +90 days
              </button>
              <button
                onClick={onArchive}
                disabled={isMutating}
                className="px-2 py-1 rounded-md bg-zinc-700/50 hover:bg-amber-900/30 text-[11px] text-zinc-400 hover:text-amber-300 transition-colors disabled:opacity-40"
                title="Archive: keep transcript, delete video"
              >
                Archive
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecordingsPanel;
