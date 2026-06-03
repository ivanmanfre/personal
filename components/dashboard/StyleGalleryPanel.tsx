import React, { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Plus, ImageUp, Sparkles, X, ExternalLink, Image as ImageIcon, FileText, Layers } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toastError } from '../../lib/dashboardActions';
import { useCarouselStyles, CarouselStyle } from '../../hooks/useCarouselStyles';
import { Card, CardLabel, Button, Input, Textarea, FieldLabel } from '../ui/primitives';

/**
 * Style Gallery — overview of every visual style the system can render in.
 *
 *  - Carousel Styles: from carousel_styles (Supabase). User can add new
 *    styles by uploading 1-6 reference images and a name; Gemini-vision
 *    describes the aesthetic into a brief, Claude re-themes the CSS kit,
 *    and the new row appears here.
 *
 *  - Lead Magnet Formats: static catalogue (matches the curator's set).
 *    For now a reference grid (no preview); rendered as their own type since
 *    each format is a different content shape, not a visual variant of one.
 *
 *  - Post Styles: text vs single-image vs carousel sit on the existing
 *    carousel_drafts.type. Carousels carry the visual style; text/single-image
 *    styling is post-by-post via image_style taxonomy.
 *
 * The "+ New style from references" form is the missing piece of the P5
 * carousel revamp (reference-image input — text brief was the only path).
 */

const STYLE_WEBHOOK =
  (import.meta as any).env?.VITE_STYLE_CREATE_WEBHOOK ||
  'https://n8n.ivanmanfredi.com/webhook/carousel-style-create';

const LM_FORMATS: { name: string; blurb: string; icon: string }[] = [
  { name: 'Interactive Assessment', blurb: 'Multi-step quiz that scores a buyer\'s AI readiness, returns a personalized blueprint.', icon: '◇' },
  { name: 'Calculator', blurb: 'One-input ROI/time-saved estimator with a custom result card + download.', icon: '∑' },
  { name: 'Checklist', blurb: 'Print-ready checklist (PDF + HTML view) for a specific workflow problem.', icon: '✓' },
  { name: 'Guide', blurb: 'Long-form HTML guide (~2-3k words) on a specific operator topic.', icon: '¶' },
  { name: 'AI Kit', blurb: 'Curated stack of 5-10 AI tools + prompts for one use-case. Replaces "swipe file".', icon: '◆' },
  { name: 'N8N Workflow', blurb: 'Importable workflow JSON + setup guide for a single automation outcome.', icon: '⌥' },
  { name: 'Stack Picker', blurb: 'Decision tree across 3-5 axes that recommends a specific tool stack.', icon: '↳' },
  { name: 'Annotated Architecture', blurb: 'System diagram with hover annotations explaining each node.', icon: '⌗' },
  { name: 'Live AI Walkthrough', blurb: 'Live SSE-streamed AI walkthrough demoing a specific problem end-to-end.', icon: '▷' },
  { name: 'Skill Pack', blurb: '3-5 cohesive Claude Skill markdown files for one operator workflow.', icon: '✦' },
];

const POST_TYPES: { name: string; type: string; blurb: string; icon: React.ReactNode }[] = [
  { name: 'Text post', type: 'text', blurb: 'Caption-only LinkedIn post. No image, no carousel — pure copy + hook.', icon: <FileText className="w-4 h-4" /> },
  { name: 'Single-image post', type: 'single_image', blurb: 'One image (uploaded from library or generated concept visual) + caption.', icon: <ImageIcon className="w-4 h-4" /> },
  { name: 'Carousel', type: 'carousel', blurb: '7-9 slides authored as HTML + CSS, rendered to PNG. Visual style picked from the Carousel Styles grid above.', icon: <Layers className="w-4 h-4" /> },
];

const StyleGalleryPanel: React.FC = () => {
  const { styles, loading, error, refresh } = useCarouselStyles();
  const [newOpen, setNewOpen] = useState(false);

  return (
    <div className="space-y-8">
      {/* ─── Carousel Styles ────────────────────────────────────────────── */}
      <section>
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <div>
            <h2 className="dv-section-h">Carousel styles</h2>
            <p className="text-[12px] text-[color:var(--d-paper-dimmer)] mt-0.5">
              Visual identity kits the renderer composes per carousel — Claude authors HTML, picks slots, applies the kit.
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={() => setNewOpen(true)}>
            <Plus className="w-3.5 h-3.5" /> New style from references
          </Button>
        </div>

        {loading && (
          <div className="text-[12px] text-zinc-500 italic flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading styles…
          </div>
        )}
        {error && (
          <div className="text-[12px] text-red-300 rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2">
            Failed to load: {error}
          </div>
        )}
        {!loading && !error && styles.length === 0 && (
          <div className="text-[12px] text-zinc-500 italic">No styles yet. The default kit lives locally in the renderer.</div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {styles.map((s) => <CarouselStyleCard key={s.id} style={s} />)}
        </div>
      </section>

      {/* ─── Post types (informational) ─────────────────────────────────── */}
      <section>
        <h2 className="dv-section-h">Post types</h2>
        <p className="text-[12px] text-[color:var(--d-paper-dimmer)] mt-0.5 mb-3">
          The three shapes a LinkedIn post can take in the system. Each carousel composes one of the styles above.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {POST_TYPES.map((t) => (
            <Card key={t.type} className="space-y-1.5">
              <div className="flex items-center gap-2 text-zinc-200">
                <span className="text-emerald-400/80">{t.icon}</span>
                <span className="text-[13px] font-medium">{t.name}</span>
              </div>
              <p className="text-[12px] leading-snug text-zinc-400">{t.blurb}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* ─── Lead Magnet formats ────────────────────────────────────────── */}
      <section>
        <h2 className="dv-section-h">Lead magnet formats</h2>
        <p className="text-[12px] text-[color:var(--d-paper-dimmer)] mt-0.5 mb-3">
          Every shape the LM engine can generate. The curator picks one per idea; format determines the build pipeline.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {LM_FORMATS.map((f) => (
            <Card key={f.name} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-emerald-400/80 text-[16px] font-mono">{f.icon}</span>
                <span className="text-[12.5px] font-medium text-zinc-200">{f.name}</span>
              </div>
              <p className="text-[11.5px] leading-snug text-zinc-400">{f.blurb}</p>
            </Card>
          ))}
        </div>
      </section>

      {newOpen && (
        <NewStyleModal
          onClose={() => setNewOpen(false)}
          onCreated={() => { setNewOpen(false); refresh(); }}
          webhookUrl={STYLE_WEBHOOK}
        />
      )}
    </div>
  );
};

// ─── Style card ───────────────────────────────────────────────────────────────
const CarouselStyleCard: React.FC<{ style: CarouselStyle }> = ({ style }) => {
  const [briefOpen, setBriefOpen] = useState(false);
  return (
    <Card className="space-y-2.5 group">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13.5px] font-semibold text-zinc-100 truncate">{style.name}</span>
            {style.isDefault && (
              <span className="text-[9.5px] uppercase tracking-wider rounded px-1.5 py-0.5 bg-emerald-900/40 text-emerald-300 ring-1 ring-emerald-700/30">default</span>
            )}
          </div>
          <div className="text-[10.5px] text-zinc-500 font-mono mt-0.5">{style.slug}</div>
        </div>
        <span className={`text-[9.5px] uppercase tracking-wider rounded px-1.5 py-0.5 ${
          style.status === 'active' ? 'bg-zinc-800 text-zinc-400' : 'bg-amber-900/40 text-amber-300'
        }`}>{style.status}</span>
      </div>

      {/* Reference image strip */}
      {style.exemplarUrls.length > 0 ? (
        <div className="grid grid-cols-3 gap-1.5">
          {style.exemplarUrls.slice(0, 6).map((url, i) => (
            <a
              key={i}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="aspect-square rounded-md overflow-hidden bg-zinc-950 ring-1 ring-zinc-800/60 hover:ring-emerald-600/40 transition"
              title="Open reference"
            >
              <img src={url} alt={`reference ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
            </a>
          ))}
        </div>
      ) : (
        <div className="h-20 rounded-md border border-dashed border-zinc-800 bg-zinc-950/40 flex items-center justify-center text-[10.5px] text-zinc-600 italic">
          No reference images
        </div>
      )}

      {/* Brief */}
      {style.brief ? (
        <div>
          <button
            onClick={() => setBriefOpen((v) => !v)}
            className="text-[11px] text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1"
          >
            {briefOpen ? '− hide brief' : '+ show brief'}
            <span className="text-zinc-600">· {style.brief.length} chars</span>
          </button>
          {briefOpen && (
            <p className="mt-1.5 text-[11.5px] leading-snug text-zinc-300 whitespace-pre-wrap">{style.brief}</p>
          )}
        </div>
      ) : (
        <div className="text-[11px] text-zinc-600 italic">No brief stored {style.isDefault ? '(uses local kit)' : ''}</div>
      )}

      {/* Kit indicator */}
      <div className="text-[10.5px] text-zinc-600 flex items-center gap-3 pt-1 border-t border-zinc-900/60">
        <span>{style.hasKit ? '✓ kit_css' : '— no kit_css'}</span>
        {style.createdAt && <span>created {new Date(style.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
      </div>
    </Card>
  );
};

// ─── New Style modal ──────────────────────────────────────────────────────────
const NewStyleModal: React.FC<{ onClose: () => void; onCreated: () => void; webhookUrl: string }> = ({ onClose, onCreated, webhookUrl }) => {
  const [name, setName] = useState('');
  const [brief, setBrief] = useState('');
  const [refs, setRefs] = useState<{ url: string; uploading?: boolean }[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const slug = useMemo(() => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48), [name]);

  const onPickFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    if (refs.length + files.length > 6) {
      toast.error('Max 6 reference images per style');
      return;
    }
    for (const file of files) {
      if (!/^image\//.test(file.type)) {
        toast.error(`Skipped ${file.name} (not an image)`);
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`Skipped ${file.name} (>10MB)`);
        continue;
      }
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
      const path = `style-refs/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from('post-stills').upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) {
        toastError(`upload ${file.name}`, upErr);
        continue;
      }
      const { data: pub } = supabase.storage.from('post-stills').getPublicUrl(path);
      setRefs((prev) => [...prev, { url: pub.publicUrl }]);
    }
  };

  const removeRef = (i: number) => setRefs((prev) => prev.filter((_, idx) => idx !== i));

  const canSubmit = name.trim().length >= 2 && (refs.length > 0 || brief.trim().length >= 20);

  const submit = async () => {
    if (!canSubmit) return;
    setBusy('create');
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          slug,
          brief: brief.trim() || undefined,
          reference_image_urls: refs.map((r) => r.url),
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text.slice(0, 200)}`);
      }
      toast.success('Style queued — Claude is re-skinning the kit (~30–60s)');
      onCreated();
    } catch (e: any) {
      toastError('create style', e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-xl bg-zinc-950 ring-1 ring-zinc-800 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-zinc-800/80 flex items-start justify-between">
          <div>
            <h3 className="text-[15px] font-semibold text-zinc-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" /> New carousel style
            </h3>
            <p className="text-[11.5px] text-zinc-500 mt-0.5">
              Upload 1-6 reference slides + a name. Gemini reads the references, distills the aesthetic, Claude re-skins the kit CSS.
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition" aria-label="close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <FieldLabel>Style name</FieldLabel>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bold Dark Statement" />
            </div>
            <div>
              <FieldLabel>Slug (auto)</FieldLabel>
              <Input value={slug} onChange={() => undefined} disabled placeholder="bold-dark-statement" />
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <FieldLabel className="!mb-0">Reference images ({refs.length}/6)</FieldLabel>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium rounded-md text-zinc-300 bg-zinc-900/70 ring-1 ring-zinc-800/80 hover:bg-zinc-800 transition-colors"
                disabled={refs.length >= 6}
              >
                <ImageUp className="w-3 h-3" /> Add images
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                multiple
                className="hidden"
                onChange={onPickFiles}
              />
            </div>
            {refs.length === 0 ? (
              <div className="rounded-md border border-dashed border-zinc-800 bg-zinc-950/40 px-3 py-6 text-center text-[11.5px] text-zinc-500 italic">
                No references yet. Upload at least one image, or write a text brief below.
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                {refs.map((r, i) => (
                  <div key={i} className="relative aspect-square rounded-md overflow-hidden bg-zinc-950 ring-1 ring-zinc-800/60">
                    <img src={r.url} alt={`ref ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeRef(i)}
                      className="absolute top-0.5 right-0.5 rounded-full bg-black/70 hover:bg-black p-0.5 text-zinc-300"
                      aria-label="remove"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <FieldLabel>Brief (optional — appended as hints to the vision describer)</FieldLabel>
            <Textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={4}
              placeholder="e.g. Warm paper background, ink-black serif headlines, single accent color (rust orange) used as punctuation, generous margins, asymmetric grid."
              className="text-[12.5px] leading-relaxed"
            />
            <p className="text-[10.5px] text-zinc-600 mt-1">
              Skip this if your references already capture the aesthetic. Use it to override a specific aspect (palette, font, mood) the references don't make obvious.
            </p>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-zinc-800/80 flex items-center justify-between">
          <a
            href={webhookUrl}
            className="text-[10.5px] text-zinc-600 inline-flex items-center gap-1 font-mono"
            target="_blank" rel="noreferrer"
            title="Style creation webhook"
          >
            <ExternalLink className="w-3 h-3" /> {webhookUrl.replace(/^https?:\/\//, '').slice(0, 50)}
          </a>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button variant="primary" size="sm" disabled={!canSubmit || !!busy} onClick={submit}>
              {busy === 'create' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Create style
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StyleGalleryPanel;
