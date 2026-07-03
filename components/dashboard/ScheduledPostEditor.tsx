import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Save, Trash2, Upload, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toastError } from '../../lib/dashboardActions';
import type { ScheduledPost } from '../../types/dashboard';
import { SchedulePicker } from './SchedulePicker';
import { ConfirmDialog } from './ConfirmDialog';

interface Props {
  post: ScheduledPost;
  onClose: () => void;
  onChanged: () => void;
}

const READONLY_STATUSES = new Set(['posted', 'posting']);
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB, matches StyleGalleryPanel

const ScheduledPostEditor: React.FC<Props> = ({ post, onClose, onChanged }) => {
  const readOnly = READONLY_STATUSES.has(post.status);
  // Cancelled/failed posts are revivable: editing + saving re-arms them to pending.
  const isDead = post.status === 'cancelled' || post.status === 'failed';
  // Guard async setState against the Sheet closing mid-flight.
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  const [text, setText] = useState(post.postText);
  const [media, setMedia] = useState<string[]>(post.mediaUrls || []);
  // datetime-local wants "YYYY-MM-DDTHH:mm" in local time.
  const [when, setWhen] = useState(() => {
    if (!post.scheduledAt) return '';
    const d = new Date(post.scheduledAt);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const uploadImage = async (file: File) => {
    if (!/^image\//.test(file.type)) { toast.error('Only image files are allowed'); return; }
    if (file.size > MAX_UPLOAD_BYTES) { toast.error('Image must be under 10MB'); return; }
    setUploading(true);
    try {
      const path = `scheduled/${post.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const { error } = await supabase.storage.from('post-stills').upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from('post-stills').getPublicUrl(path);
      if (mounted.current) setMedia((m) => [...m, data.publicUrl]);
    } catch (err) {
      toastError('upload image', err);
    } finally {
      if (mounted.current) setUploading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const patch: Record<string, unknown> = { post_text: text, media_urls: media };
      if (when) patch.scheduled_at = new Date(when).toISOString();
      // Reviving a cancelled/failed post re-arms it for publishing.
      if (isDead) patch.status = 'pending';
      const { error } = await supabase.from('scheduled_posts').update(patch).eq('id', post.id);
      if (error) throw error;
      toast.success(isDead ? 'Rescheduled — back on the calendar' : 'Saved');
      onChanged();
      onClose();
    } catch (err) {
      toastError('save scheduled post', err);
      if (mounted.current) setSaving(false);
    }
  };

  const cancelPost = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('scheduled_posts').update({ status: 'cancelled' }).eq('id', post.id);
      if (error) throw error;
      toast.success('Post cancelled');
      onChanged();
      onClose();
    } catch (err) {
      toastError('cancel scheduled post', err);
      if (mounted.current) setSaving(false);
    }
  };

  return (
    <div className="p-4 space-y-4 text-sm">
      {readOnly && (
        <div className="rounded-md bg-amber-500/10 ring-1 ring-amber-500/30 text-amber-300 px-3 py-2">
          This post already went out ({post.status}) — fields are read-only.
        </div>
      )}
      {isDead && (
        <div className="rounded-md bg-violet-500/10 ring-1 ring-violet-500/30 text-violet-200 px-3 py-2">
          This post is {post.status}. Set a time and Save to put it back on the calendar.
        </div>
      )}
      <label className="block">
        <span className="text-zinc-400 text-xs">Post text</span>
        <textarea
          value={text} disabled={readOnly} onChange={(e) => setText(e.target.value)}
          rows={12}
          className="mt-1 w-full rounded-md bg-zinc-900 ring-1 ring-zinc-700 px-3 py-2 text-zinc-100 disabled:opacity-60"
        />
      </label>

      <div>
        <span className="text-zinc-400 text-xs">Media</span>
        <div className="mt-1 flex flex-wrap gap-2">
          {media.map((url) => (
            <div key={url} className="relative">
              <img src={url} alt="" className="h-20 w-20 object-cover rounded-md ring-1 ring-zinc-700" />
              {!readOnly && (
                <button
                  onClick={() => setMedia((m) => m.filter((u) => u !== url))}
                  className="absolute -top-1.5 -right-1.5 bg-zinc-800 ring-1 ring-zinc-600 rounded-full p-0.5"
                  title="Remove"
                ><X className="w-3 h-3" /></button>
              )}
            </div>
          ))}
          {!readOnly && (
            <label className="h-20 w-20 grid place-items-center rounded-md ring-1 ring-dashed ring-zinc-600 cursor-pointer hover:bg-zinc-900">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 text-zinc-400" />}
              <input type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.currentTarget.value = ''; }} />
            </label>
          )}
        </div>
      </div>

      <label className="block">
        <span className="text-zinc-400 text-xs">Scheduled time</span>
        <div className="mt-1"><SchedulePicker value={when} onChange={setWhen} disabled={readOnly} openDirection="down" /></div>
      </label>

      {!readOnly && (
        <div className="flex items-center justify-between pt-2">
          {isDead ? <span /> : (
            <button onClick={() => setConfirmCancel(true)} disabled={saving}
              className="inline-flex items-center gap-1.5 text-red-400 hover:text-red-300 text-xs">
              <Trash2 className="w-3.5 h-3.5" /> Cancel post
            </button>
          )}
          <button onClick={save} disabled={saving || uploading}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-white">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} {isDead ? 'Reschedule' : 'Save'}
          </button>
        </div>
      )}
      <ConfirmDialog
        open={confirmCancel}
        title="Cancel this post?"
        body="It stays as a record but will not publish."
        confirmLabel="Cancel post"
        danger
        onConfirm={() => { setConfirmCancel(false); cancelPost(); }}
        onCancel={() => setConfirmCancel(false)}
      />
    </div>
  );
};

export default ScheduledPostEditor;
