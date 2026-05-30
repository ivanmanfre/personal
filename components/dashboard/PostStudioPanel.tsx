import React, { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Loader2, RefreshCw, FileText } from 'lucide-react';
import { useContentLibrary, type CarouselDraft } from '../../hooks/useContentLibrary';
import { generatePostContent } from '../../lib/studioActions';
import { toastError } from '../../lib/dashboardActions';
import { supabase } from '../../lib/supabase';
import CarouselEditor from './CarouselEditor';

type PostType = 'text' | 'single_image';

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-zinc-700/60 text-zinc-300',
  generating: 'bg-sky-900/50 text-sky-300',
  qa_review: 'bg-amber-900/50 text-amber-300',
  ready: 'bg-emerald-900/50 text-emerald-300',
  scheduled: 'bg-sky-900/50 text-sky-300',
  published: 'bg-zinc-800 text-zinc-400',
  failed: 'bg-red-900/50 text-red-300',
};

const PostStudioPanel: React.FC = () => {
  const { drafts, loading, refresh } = useContentLibrary();
  const [type, setType] = useState<PostType>('text');
  const [topic, setTopic] = useState('');
  const [details, setDetails] = useState('');
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  // Show only text + single-image posts (carousels live in the Carousel Studio panel)
  const visible = drafts.filter((d) => d.type === 'text' || d.type === 'single_image' || (!d.type && (d.postBody || d.imageUrls.length === 0)));

  const open = drafts.find((d) => d.id === openId) || null;

  async function handleCreate() {
    if (!topic.trim()) { toast.error('Enter a topic'); return; }
    setCreating(true);
    try {
      // Studio pre-creates the carousel_drafts row, then fires post-gen-v2 webhook.
      const { data, error } = await supabase
        .from('carousel_drafts')
        .insert({ topic: topic.trim(), type, status: 'generating' })
        .select('id')
        .single();
      if (error) throw error;
      const draftId = data.id as string;
      await generatePostContent({
        draft_id: draftId,
        topic: topic.trim(),
        title: topic.trim(),
        author: 'Ivan',
        source: 'Studio',
        post_format: type === 'single_image' ? 'Single Image' : 'Text Post',
        post_format_details: details.trim() || (type === 'single_image' ? 'standard post with concept image' : 'standard text post'),
        include_image: type === 'single_image' ? 'Yes' : 'No',
        image_style: type === 'single_image' ? 'Concept Visual' : undefined,
      });
      toast.success('Generation fired (~8 min). Status will move to qa_review when done.');
      setTopic(''); setDetails('');
      await refresh();
      setOpenId(draftId);
    } catch (err) {
      toastError('create post', err);
    } finally {
      setCreating(false);
    }
  }

  if (open) {
    return <CarouselEditor draft={open} onClose={() => setOpenId(null)} onChanged={refresh} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <FileText className="w-5 h-5 text-emerald-400" />
        <h2 className="text-lg font-semibold text-zinc-100">Post Studio</h2>
        <span className="text-xs text-zinc-500">— text + single-image (carousels live in Carousel Studio)</span>
        <button onClick={refresh} className="ml-auto p-2 text-zinc-400 hover:text-zinc-200" title="Refresh">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* New post */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
        <div className="text-sm font-medium text-zinc-300">New post</div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-zinc-400">Type</span>
          <button
            onClick={() => setType('text')}
            className={`rounded px-3 py-1 ${type === 'text' ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
          >Text post</button>
          <button
            onClick={() => setType('single_image')}
            className={`rounded px-3 py-1 ${type === 'single_image' ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
          >Single image</button>
        </div>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Topic — e.g. Stop hiring to fix a process you haven't automated yet"
          className="w-full rounded-md bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600"
        />
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Post format details (optional)"
          rows={2}
          className="w-full rounded-md bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600"
        />
        <button
          onClick={handleCreate}
          disabled={creating}
          className="inline-flex items-center gap-2 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white"
        >
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          {creating ? 'Firing…' : `Generate ${type === 'single_image' ? 'single-image' : 'text'} post (~8 min)`}
        </button>
      </div>

      {/* Library */}
      {loading && visible.length === 0 ? (
        <div className="text-sm text-zinc-500">Loading…</div>
      ) : visible.length === 0 ? (
        <div className="text-sm text-zinc-500">No posts yet — create one above.</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {visible.map((d: CarouselDraft) => (
            <button
              key={d.id}
              onClick={() => setOpenId(d.id)}
              className="text-left rounded-lg border border-zinc-800 bg-zinc-900/50 overflow-hidden hover:border-zinc-600 transition"
            >
              <div className="aspect-[4/5] bg-zinc-950 overflow-hidden">
                {d.imageUrls[0]
                  ? <img src={d.imageUrls[0]} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-zinc-700 text-xs">{d.type === 'text' ? 'TEXT' : d.type === 'single_image' ? 'IMAGE' : '—'}</div>}
              </div>
              <div className="p-3 space-y-2">
                <div className="text-sm text-zinc-200 line-clamp-2">{d.title}</div>
                <div className="flex items-center gap-2">
                  <span className={`inline-block rounded px-2 py-0.5 text-[11px] ${STATUS_STYLE[d.status] || STATUS_STYLE.draft}`}>
                    {d.status}
                  </span>
                  {d.type && <span className="text-[11px] text-zinc-500">{d.type === 'single_image' ? 'single image' : d.type}</span>}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default PostStudioPanel;
