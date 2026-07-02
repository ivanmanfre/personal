import React, { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Plus, ImageUp, Sparkles, X, ExternalLink, MessageCircle, Type as TypeIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toastError } from '../../lib/dashboardActions';
import { useCarouselStyles, CarouselStyle } from '../../hooks/useCarouselStyles';
import { useStylePrompts, StylePrompt } from '../../hooks/useStylePrompts';
import { Card, Button, Input, Textarea, FieldLabel } from '../ui/primitives';
import { renderLightMarkdown } from '../../lib/lightMarkdown';
import { PanelIntro } from '../dashboard-v2/primitives';

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

// ─── Asset Styles catalog ────────────────────────────────────────────────────
// Ivan's full visual style catalogue, sourced from the ClickUp Asset Styles
// list (901325469493 — 15 styles). Split by category since carousels and
// single-image posts use different generation paths and shouldn't blend in
// one grid. Use counts from carousel_drafts taxonomy show real usage.
//
// Carousel styles are LAYOUT archetypes — Claude composes the body using one
// of these as a structural template. The visual brand (palette, fonts, accent)
// comes from a row in carousel_styles (the Comic Explainer / Editorial row is
// the default; reference-image-derived kits override it).
//
// Single-image styles are IMAGE INTENT — they steer the image-generation agent
// (Gemini) toward a specific composition (chart, stat card, lifestyle photo,
// etc.) and are picked per-post via taxonomy.image_style.
//
// To keep the grid in sync with ClickUp, each card carries its ClickUp task ID
// so the user can click through to the live prompt + reference assets.

interface AssetStyle {
  id: string;                 // ClickUp task ID
  name: string;
  blurb: string;
  category: 'carousel' | 'single_image';
  promptSlug?: string;        // content_prompts.slug — set for carousel layouts that have a full prompt page mirrored
  usage?: number;             // distinct rows in carousel_drafts using this style
}

const ASSET_STYLES: AssetStyle[] = [
  // ── Carousel layout archetypes (9) ─────────────────────────────────────
  // promptSlug maps to a row in content_prompts (synced from ClickUp doc 2ky5ezad-853
  // by workflow 1jOmMEhOzxkabJYs). Adding a new style = (1) ClickUp page, (2) add
  // page_id→slug entry to that workflow, (3) add slug here.
  { id: '86afg31q5', name: 'Comic Explainer', category: 'carousel', promptSlug: 'style-comic-explainer', blurb: 'Cover with editorial illustrated Ivan + 6–8 sequential beats via speech bubbles and short captions. Visual identity = the Editorial Comic-Grid kit (default).' },
  { id: '86ahe7r3g', name: 'Founder Process', category: 'carousel', promptSlug: 'style-founder-process', blurb: 'Cover with editorial Ivan portrait + bold serif italic headline → 5–6 process-beat slides, each with a sage outlined pill section-label top-center + photoreal Ivan in that beat.' },
  { id: '86aff082u', name: 'Case Study', category: 'carousel', promptSlug: 'style-case-study', blurb: 'Cover → Challenge → Approach → Implementation (1–3 slides) → Results → Takeaways → CTA. Text-only PDF carousel — no AI imagery on body slides.' },
  { id: '86afdhqx6', name: 'Framework Walkthrough', category: 'carousel', promptSlug: 'style-framework-walkthrough', blurb: 'Framework name on cover → one component per slide → full diagram → CTA. Long-form architectural teardown.' },
  { id: '86afdhqwm', name: 'Data-Driven', category: 'carousel', promptSlug: 'style-data-driven', blurb: 'Stat headline cover → one stat per slide → CTA. Best for receipts, benchmarks, audit findings.' },
  { id: '86afdhqw8', name: 'Before-After', category: 'carousel', promptSlug: 'style-before-after', blurb: '"Before vs After" cover → comparison pairs → CTA. Two-column visual on each body slide.' },
  { id: '86afdhqvg', name: 'Myth-Busting', category: 'carousel', promptSlug: 'style-myth-busting', blurb: '"Myths vs Reality" cover → myth/truth pairs → CTA. Each body slide flags a misconception and corrects it.' },
  { id: '86afdhqrm', name: 'Step-by-Step', category: 'carousel', promptSlug: 'style-step-by-step', blurb: 'Numbered cover → one step per slide → CTA. Clean linear sequence; pairs well with checklists.' },
  { id: '86afdhqr9', name: 'Educational Breakdown', category: 'carousel', promptSlug: 'style-educational-breakdown', blurb: 'Title card → icon + key takeaway per slide → CTA. Lowest-friction format — one idea per beat.' },

  // ── Single-image post styles (6) ───────────────────────────────────────
  // No promptSlug — single_image style hints are embedded in the Image Agent's
  // main post-generation prompt (slug 'post-generation'), not separate pages.
  { id: '86afhgewx', name: 'Framework Diagram', category: 'single_image', blurb: 'Single architectural diagram — boxes/arrows showing how components connect. Most-used single_image style (19 posts).' },
  { id: '86afhgex8', name: 'Stat Card', category: 'single_image', blurb: 'Single oversized stat with caption underneath. Receipt-style proof point — 1 number, 1 line of context.' },
  { id: '86afhgexy', name: 'Concept Visual', category: 'single_image', blurb: 'Abstract conceptual illustration — metaphor for the post idea. Used when no concrete data or person is the subject.' },
  { id: '86afhgevv', name: 'Lifestyle Photo', category: 'single_image', blurb: 'Photoreal Ivan in setting (founder/office/screen). Best for personality posts + Founder Lifestyle pillar.' },
  { id: '86afhgf0v', name: 'Before/After', category: 'single_image', blurb: 'Two-pane visual contrast in a single image. Side-by-side or stacked.' },
  { id: '86afhgf1e', name: 'Quote Card', category: 'single_image', blurb: 'Single quote rendered as a typographic card (no portrait). Tactical hook for quote-cold-open posts.' },
];

// ─── Text-post style patterns ─────────────────────────────────────────────────
// Text posts have NO image style — their "style" lives in two taxonomy axes:
// hook_type (the opening pattern) and pillar (the content angle). Both come
// from the generator's prompt library; numbers reflect actual use.

interface TextStyle {
  name: string;
  axis: 'hook' | 'pillar';
  blurb: string;
}

const TEXT_STYLES: TextStyle[] = [
  // Hook patterns — opening shapes the generator picks per post
  { name: 'Counter-instruction', axis: 'hook', blurb: '"Do not do X" or "Stop doing Y" opener — Ivan\'s preferred pattern. Every 5-hook batch includes ≥1 counter-instruction variant. (V3 Pattern G)' },
  { name: 'Imperative counter', axis: 'hook', blurb: '"Don\'t [common practice]. [Alternative]." Direct contrarian opener — close cousin to counter-instruction but tighter.' },
  { name: 'Quote cold-open', axis: 'hook', blurb: 'Pastes a real quote from a client/competitor/audience comment as the first line. Pairs with the Quote Card image style.' },
  { name: 'Specific receipt', axis: 'hook', blurb: 'Opens with a concrete number/timestamp/result. "Last Tuesday a client asked X. Two hours later, Y." Highest-credibility hook.' },
  { name: 'Story opener', axis: 'hook', blurb: 'In-medias-res narrative. "I was on a call when…" Pulls readers in via Story tension; longer body to pay it off.' },
  { name: 'Universal aspirational', axis: 'hook', blurb: 'States a universal frustration/desire ICP feels. Lowest-friction hook; risk = generic if not paired with a specific receipt.' },
  // Pillars — the angle, regardless of hook
  { name: 'Methodology', axis: 'pillar', blurb: 'Frameworks, decision trees, criteria-based content. The "how I think about X" pillar. Highest usage (9 posts).' },
  { name: 'Audit-Receipt', axis: 'pillar', blurb: 'Concrete findings from real audits — anonymized but specific. Builds expertise via proof points.' },
  { name: 'Translator', axis: 'pillar', blurb: 'Translates AI/tech concepts for operator-buyers. Bridges agency-owner vocabulary to Ivan\'s technical world.' },
  { name: 'Personal POV', axis: 'pillar', blurb: 'First-person opinion + experience. The personality pillar; carries Founder Lifestyle photos when paired with single_image.' },
  { name: 'Founder Lifestyle', axis: 'pillar', blurb: 'Behind-the-scenes texture — what running the operation actually looks like. Always pairs with Lifestyle Photo.' },
];

// ─── Lead Magnet formats ──────────────────────────────────────────────────────
const LM_FORMATS: { name: string; blurb: string; icon: string }[] = [
  { name: 'Interactive Assessment', blurb: "Multi-step quiz that scores a buyer's AI readiness, returns a personalized blueprint.", icon: '◇' },
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

const StyleGalleryPanel: React.FC = () => {
  const { styles, loading, error, refresh } = useCarouselStyles();
  const { prompts: stylePrompts } = useStylePrompts();
  const [newOpen, setNewOpen] = useState(false);

  return (
    <div className="space-y-8">
      <PanelIntro
        tourId="styles"
        purpose="One idea, rendered into nine on-brand carousel styles and video."
        how="Each style is a brand-locked layout kit; the system composes real logos and screenshots into slides, not text baked into images."
      />
      {/* ─── Carousel — visual identity kits (Supabase) ─────────────────── */}
      <section>
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <div>
            <h2 className="dv-section-h">Carousel — visual identity kits</h2>
            <p className="text-[12px] text-[color:var(--d-paper-dimmer)] mt-0.5">
              Brand kits the renderer applies (palette, fonts, accent). Default = Editorial Comic-Grid (Comic Explainer). Add your own from reference slides.
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={() => setNewOpen(true)}>
            <Plus className="w-3.5 h-3.5" /> New kit from references
          </Button>
        </div>

        {loading && (
          <div className="text-[12px] text-zinc-500 italic flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading kits…
          </div>
        )}
        {error && (
          <div className="text-[12px] text-red-300 rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2">
            Failed to load: {error}
          </div>
        )}
        {!loading && !error && styles.length === 0 && (
          <div className="text-[12px] text-zinc-500 italic">No kits yet. The default kit lives locally in the renderer.</div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {styles.map((s) => <CarouselStyleCard key={s.id} style={s} />)}
        </div>
      </section>

      {/* ─── Carousel layout archetypes (Asset Styles, ClickUp) ─────────── */}
      <section>
        <h2 className="dv-section-h">Carousel — layout archetypes</h2>
        <p className="text-[12px] text-[color:var(--d-paper-dimmer)] mt-0.5 mb-3">
          Structural templates Claude composes per carousel. The author picks one per post; the kit above paints it.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {ASSET_STYLES.filter((s) => s.category === 'carousel').map((s) => (
            <AssetStyleCard key={s.id} style={s} prompt={s.promptSlug ? stylePrompts[s.promptSlug] : undefined} />
          ))}
        </div>
      </section>

      {/* ─── Single-image styles ────────────────────────────────────────── */}
      <section>
        <h2 className="dv-section-h">Single-image styles</h2>
        <p className="text-[12px] text-[color:var(--d-paper-dimmer)] mt-0.5 mb-3">
          Image intents the generator picks per single-image post — steers the Gemini image agent toward a specific composition.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {ASSET_STYLES.filter((s) => s.category === 'single_image').map((s) => (
            <AssetStyleCard key={s.id} style={s} prompt={s.promptSlug ? stylePrompts[s.promptSlug] : undefined} />
          ))}
        </div>
      </section>

      {/* ─── Text-post style patterns ───────────────────────────────────── */}
      <section>
        <h2 className="dv-section-h">Text-post style patterns</h2>
        <p className="text-[12px] text-[color:var(--d-paper-dimmer)] mt-0.5 mb-3">
          Text posts have no image style — their style is the hook pattern + content pillar the generator picks from the prompt library.
        </p>

        <div className="space-y-3">
          <div>
            <div className="text-[10.5px] uppercase tracking-wider text-emerald-400/70 font-semibold mb-1.5">Hook patterns</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {TEXT_STYLES.filter((s) => s.axis === 'hook').map((s) => <TextStyleCard key={s.name} style={s} />)}
            </div>
          </div>
          <div>
            <div className="text-[10.5px] uppercase tracking-wider text-emerald-400/70 font-semibold mb-1.5 mt-1">Content pillars</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {TEXT_STYLES.filter((s) => s.axis === 'pillar').map((s) => <TextStyleCard key={s.name} style={s} />)}
            </div>
          </div>
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

// ─── Asset Style card (ClickUp-backed layout archetypes + image intents) ─────
const AssetStyleCard: React.FC<{ style: AssetStyle; prompt?: StylePrompt }> = ({ style, prompt }) => {
  const [open, setOpen] = useState(false);
  const hasPrompt = !!prompt && !!prompt.body;
  return (
    <Card className="space-y-2 group">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold text-zinc-100 truncate">{style.name}</div>
          <div className="text-[10px] text-zinc-500 mt-0.5 uppercase tracking-wider">
            {style.category === 'carousel' ? 'Carousel layout' : 'Single-image intent'}
          </div>
        </div>
        <a
          href={`https://app.clickup.com/t/${style.id}`}
          target="_blank"
          rel="noreferrer"
          className="opacity-50 hover:opacity-100 transition text-emerald-400 hover:text-emerald-300 shrink-0"
          title="Open style task in ClickUp"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
      <p className="text-[11.5px] leading-snug text-zinc-400">{style.blurb}</p>

      {hasPrompt && (
        <div className="pt-1 border-t border-zinc-900/60">
          <button
            onClick={() => setOpen((v) => !v)}
            className="text-[11px] text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1"
          >
            {open ? '− hide prompt' : '+ show prompt'}
          </button>
          {open && (
            <div className="mt-2 rounded-md border border-zinc-800/60 bg-zinc-950/50 px-3 py-2 max-h-[420px] overflow-y-auto">
              {renderLightMarkdown(prompt!.body, { editorial: true })}
            </div>
          )}
        </div>
      )}
      {style.category === 'carousel' && !hasPrompt && (
        <div className="text-[10.5px] text-amber-400/70 italic pt-1 border-t border-zinc-900/60">
          Prompt not yet synced — runs daily 04:00 UTC.
        </div>
      )}
    </Card>
  );
};

// ─── Text-post style card (hook patterns + content pillars) ──────────────────
const TextStyleCard: React.FC<{ style: TextStyle }> = ({ style }) => (
  <Card className="space-y-1.5">
    <div className="flex items-center gap-2">
      {style.axis === 'hook'
        ? <MessageCircle className="w-3.5 h-3.5 text-emerald-400/80" />
        : <TypeIcon className="w-3.5 h-3.5 text-emerald-400/80" />}
      <span className="text-[13px] font-medium text-zinc-100">{style.name}</span>
    </div>
    <p className="text-[11.5px] leading-snug text-zinc-400">{style.blurb}</p>
  </Card>
);

// ─── Carousel-kit card (Supabase-backed visual identity kits) ────────────────
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
        <div className="aspect-[16/9] rounded-md overflow-hidden ring-1 ring-zinc-800/60 bg-[var(--d-ink-3)] border border-[var(--d-rule)] flex flex-col justify-center px-3 py-2">
          <div className="text-[9px] uppercase tracking-wider text-emerald-400/60 mb-1">{style.isDefault ? 'Default kit · rendered live' : 'Brand kit'}</div>
          <div className="text-[13px] leading-tight text-[var(--d-paper-dim)] font-serif italic line-clamp-2">{style.name}</div>
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
