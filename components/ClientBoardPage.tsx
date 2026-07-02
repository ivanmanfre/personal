import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { buildAssessmentEmbedUrl } from '../lib/assessmentEmbed';
import LinkedInPostPreview from './ui/LinkedInPostPreview';
import LiveAssessmentEmbed from './ui/LiveAssessmentEmbed';

/**
 * /client/:slug — the per-client content board (demo mode).
 * Token-gated via the get_client_board RPC; fetches ONLY the board payload
 * (never Ivan's dashboard context — this is a client-facing surface).
 * Light Premium skin + the client's own brand accent/logo/heading font.
 */

// ---------- types (shape of client_boards.board) ----------
interface BoardBrand {
  accent_hex?: string;
  accent_secondary?: string;
  font_heading?: string;
  font_body?: string;
  is_dark?: boolean;
  logo_url?: string;
}
interface QueueItem {
  id: string;
  kind: 'post' | 'carousel' | 'lm';
  pillar?: string;
  hook?: string;
  body?: string;
  media_url?: string | null;
  title?: string;
  promise?: string;
  cover_url?: string;
  publish_date?: string;
}
interface CalendarItem { date: string; kind: string; pillar?: string; label: string }
interface Pillar { key: string; label: string; count: number; pct: number; blurb?: string }
interface Board {
  company_name: string;
  domain?: string;
  logo_url?: string;
  founder?: { name?: string; headline?: string; first_name?: string; avatar_url?: string };
  brand?: BoardBrand;
  queue: QueueItem[];
  lm?: any;
  strategy?: { total: number; period?: string; pillars: Pillar[] };
  calendar?: { start: string; weeks: number; items: CalendarItem[] };
  auto_publish_days?: number;
}

// ---------- small utils ----------
const INK = '#0f172a';
const DIM = '#475569';
const FAINT = '#64748b';
const LINE = '#e9e9ee';
const CARD_SHADOW = '0 1px 2px rgba(15,23,42,.04), 0 10px 26px -18px rgba(15,23,42,.18)';
const SERIF = '"DM Serif Display", serif';

function cleanHex(hex?: string, fallback = '#4f46e5'): string {
  const h = (hex || '').replace(/[^0-9a-fA-F]/g, '');
  return h.length === 6 ? `#${h}` : fallback;
}
function inkOn(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.62 ? '#141210' : '#ffffff';
}
function fmtDay(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}
function lmPath(title?: string): string {
  return (title || 'lead-magnet').toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim()
    .split(/\s+/).slice(-3).join('-');
}

// Segment tints: the client's accent mixed toward white at stepped ratios, so the
// bar reads as one brand family, never a rainbow.
const TINT_STEPS = [26, 20, 15, 11, 8];

// ---------- shared bits ----------
function StatusPill({ children, tone, accent }: { children: React.ReactNode; tone: 'review' | 'scheduled' | 'neutral'; accent: string }) {
  const styles: Record<string, React.CSSProperties> = {
    review: { background: `color-mix(in srgb, ${accent} 12%, white)`, color: INK },
    scheduled: { background: '#ecfdf5', color: '#047857' },
    neutral: { background: '#f1f5f9', color: DIM },
  };
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold" style={styles[tone]}>
      {children}
    </span>
  );
}

function SectionHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-[22px] font-semibold tracking-tight" style={{ color: INK }}>{title}</h2>
      {sub && <p className="mt-1 text-[14px] leading-relaxed" style={{ color: DIM }}>{sub}</p>}
    </div>
  );
}

// ---------- Review surface ----------
function ReviewSurface({ board, accent }: { board: Board; accent: string }) {
  const [approved, setApproved] = useState<Record<string, boolean>>({});
  const [changing, setChanging] = useState<string | null>(null);
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState('');
  const autoDays = board.auto_publish_days ?? 3;
  const pending = board.queue.filter((q) => !approved[q.id]);
  const done = board.queue.filter((q) => approved[q.id]);
  const ctaInk = inkOn(accent);

  const card = (q: QueueItem) => {
    const isApproved = !!approved[q.id];
    return (
      <div key={q.id} className="rounded-[14px] bg-white p-4 sm:p-5" style={{ border: `1px solid ${LINE}`, boxShadow: CARD_SHADOW }}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <StatusPill tone={isApproved ? 'scheduled' : 'review'} accent={accent}>
            {isApproved ? 'Scheduled' : 'Your review'}
          </StatusPill>
          <StatusPill tone="neutral" accent={accent}>{q.kind === 'lm' ? 'Lead magnet' : q.kind === 'carousel' ? 'Carousel' : 'Post'}</StatusPill>
          <span className="ml-auto text-[13px]" style={{ color: FAINT }}>
            {isApproved ? `Publishes ${fmtDay(q.publish_date)}` : `Publishes ${fmtDay(q.publish_date)} unless you change it`}
          </span>
        </div>

        {q.kind === 'lm' ? (
          <div className="flex flex-col gap-4 sm:flex-row">
            {q.cover_url && (
              <img src={q.cover_url} alt="" className="w-full rounded-lg object-cover sm:w-44" style={{ border: `1px solid ${LINE}` }} />
            )}
            <div className="min-w-0">
              <div className="text-[16px] font-semibold" style={{ color: INK }}>{q.title}</div>
              <p className="mt-1 text-[14px] leading-relaxed" style={{ color: DIM }}>{q.promise}</p>
              <p className="mt-2 text-[13px]" style={{ color: FAINT }}>Interactive assessment on your domain. Try it live in the Lead magnet tab.</p>
            </div>
          </div>
        ) : (
          <LinkedInPostPreview
            text={q.body || ''}
            author={board.founder?.name || board.company_name}
            headline={board.founder?.headline || ''}
            avatarUrl={board.founder?.avatar_url || ''} /* '' forces initials — the component's default is Ivan's portrait */
            mediaUrl={q.media_url || undefined}
            stats={{ reactions: 0, comments: 0 }}
            showFold
          />
        )}

        {!isApproved && (
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => { setApproved((s) => ({ ...s, [q.id]: true })); setChanging(null); }}
              className="inline-flex min-h-[44px] items-center rounded-lg px-5 text-[14px] font-semibold transition-transform active:scale-[.98]"
              style={{ background: accent, color: ctaInk }}
            >
              Approve
            </button>
            <button
              onClick={() => { setChanging(changing === q.id ? null : q.id); setNote(''); }}
              className="inline-flex min-h-[44px] items-center rounded-lg px-4 text-[14px] font-semibold"
              style={{ border: `1px solid ${LINE}`, color: DIM, background: '#fff' }}
            >
              Request changes
            </button>
            {sent[q.id] && <span className="text-[13px] font-medium" style={{ color: '#047857' }}>Sent. Your operator will adjust it before the publish date.</span>}
          </div>
        )}

        {changing === q.id && !isApproved && (
          <div className="mt-3">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Tell us what to change, in plain words."
              rows={3}
              className="w-full rounded-lg p-3 text-[14px] outline-none"
              style={{ border: `1px solid ${LINE}`, color: INK, background: '#fbfcfd' }}
            />
            <button
              onClick={() => { setSent((s) => ({ ...s, [q.id]: true })); setChanging(null); }}
              className="mt-2 inline-flex min-h-[44px] items-center rounded-lg px-4 text-[14px] font-semibold"
              style={{ border: `1px solid ${LINE}`, color: INK, background: '#fff' }}
            >
              Send to your operator
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <SectionHead
        title="Your review"
        sub={`Approve, edit, or request a change. Anything you don't touch publishes automatically after ${autoDays} days.`}
      />
      <div className="flex flex-col gap-5">{pending.map(card)}</div>
      {pending.length === 0 && (
        <div className="rounded-[14px] bg-white p-8 text-center" style={{ border: `1px solid ${LINE}` }}>
          <div className="text-[16px] font-semibold" style={{ color: INK }}>All reviewed.</div>
          <p className="mt-1 text-[14px]" style={{ color: DIM }}>New drafts land here every morning. That was the whole job.</p>
        </div>
      )}
      {done.length > 0 && (
        <div className="mt-8">
          <div className="mb-3 text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: FAINT }}>Scheduled</div>
          <div className="flex flex-col gap-5 opacity-80">{done.map(card)}</div>
        </div>
      )}
    </div>
  );
}

// ---------- Calendar surface ----------
function CalendarSurface({ board, accent }: { board: Board; accent: string }) {
  const cal = board.calendar;
  if (!cal) return null;
  const start = new Date(cal.start + 'T00:00:00');
  const byDate = new Map<string, CalendarItem[]>();
  cal.items.forEach((it) => {
    const arr = byDate.get(it.date) || [];
    arr.push(it);
    byDate.set(it.date, arr);
  });
  const totals = { post: 0, carousel: 0, lm: 0, newsletter: 0 };
  cal.items.forEach((it) => { if (it.kind in totals) (totals as any)[it.kind] += 1; });

  const chipStyle = (kind: string): React.CSSProperties => {
    switch (kind) {
      case 'post': return { background: `color-mix(in srgb, ${accent} 14%, white)`, color: INK };
      case 'carousel': return { background: `color-mix(in srgb, ${accent} 30%, white)`, color: INK };
      case 'lm': return { background: '#f3eefe', color: '#6d28d9' };
      case 'newsletter': return { background: '#f1f5f9', color: DIM };
      case 'newsjack': return { background: '#fff', color: FAINT, border: `1px dashed ${LINE}` };
      default: return { background: '#f1f5f9', color: DIM };
    }
  };

  const weeks: Date[][] = [];
  for (let w = 0; w < cal.weeks; w++) {
    const row: Date[] = [];
    for (let d = 0; d < 7; d++) row.push(new Date(start.getTime() + (w * 7 + d) * 86400000));
    weeks.push(row);
  }
  const num = (n: number) => (
    <span style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 26, lineHeight: 1, color: INK }}>{n}</span>
  );

  return (
    <div>
      <SectionHead title="Your calendar" sub="A month of content, planned and drafted for you. Every item lands in your review first." />
      <div className="mb-5 flex flex-wrap gap-3">
        {[
          [totals.post + totals.carousel, 'posts'],
          [totals.lm, 'lead magnets'],
          [totals.newsletter, 'newsletters'],
        ].map(([n, label]) => (
          <div key={label as string} className="flex items-baseline gap-2 rounded-[14px] bg-white px-4 py-3" style={{ border: `1px solid ${LINE}`, boxShadow: CARD_SHADOW }}>
            {num(n as number)}
            <span className="text-[13px] font-medium" style={{ color: DIM }}>{label}</span>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-[14px] bg-white p-3 sm:p-4" style={{ border: `1px solid ${LINE}`, boxShadow: CARD_SHADOW }}>
        <div className="min-w-[640px]">
          <div className="grid grid-cols-7 gap-1.5 pb-2">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div key={d} className="px-2 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: FAINT }}>{d}</div>
            ))}
          </div>
          {weeks.map((row, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-1.5 pb-1.5">
              {row.map((d) => {
                const iso = d.toISOString().slice(0, 10);
                const items = byDate.get(iso) || [];
                return (
                  <div key={iso} className="min-h-[92px] rounded-lg p-1.5" style={{ border: `1px solid ${LINE}`, background: items.length ? '#fff' : '#fbfcfd' }}>
                    <div className="px-0.5 pb-1 text-[12px] font-medium" style={{ color: FAINT }}>{d.getDate()}</div>
                    <div className="flex flex-col gap-1">
                      {items.map((it, i) => (
                        <div key={i} className="truncate rounded px-1.5 py-0.5 text-[11px] font-semibold" style={chipStyle(it.kind)}>{it.label}</div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 text-[13px]" style={{ color: FAINT }}>Newsjack slots stay open on purpose: when news breaks in your niche, a reactive post takes the slot same-day.</p>
    </div>
  );
}

// ---------- Lead magnet surface ----------
function LeadMagnetSurface({ board, accent }: { board: Board; accent: string }) {
  const lm = board.lm;
  // Default src (scan_embed) keeps the engine's embed mode: Ivan's chrome/greeting
  // stripped + the client's accent/fonts applied. A dedicated client_board src would
  // need an engine-side alias first.
  const src = useMemo(() => buildAssessmentEmbedUrl(lm), [lm]);
  return (
    <div>
      <SectionHead
        title="Your lead magnet"
        sub="Live and interactive, exactly what your leads see. It scores them, then captures their email."
      />
      {src ? (
        <LiveAssessmentEmbed
          src={src}
          title={lm?.title}
          domain={board.domain}
          urlPath={lmPath(lm?.title)}
          logoUrl={board.logo_url}
          accentHex={accent}
          companyName={board.company_name}
          height={980}
        />
      ) : (
        <div className="rounded-[14px] bg-white p-8" style={{ border: `1px solid ${LINE}` }}>
          <p className="text-[14px]" style={{ color: DIM }}>Your first lead magnet is in production. It lands here for review this week.</p>
        </div>
      )}

      <div className="mt-6 rounded-[14px] bg-white p-4 sm:p-5" style={{ border: `1px solid ${LINE}`, boxShadow: CARD_SHADOW }}>
        <div className="mb-3 text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: FAINT }}>Captured leads</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-[13px]">
            <thead>
              <tr style={{ color: FAINT }}>
                <th className="pb-2 font-medium">Email</th>
                <th className="pb-2 font-medium">Score</th>
                <th className="pb-2 font-medium">Weakest area</th>
                <th className="pb-2 font-medium">When</th>
              </tr>
            </thead>
            <tbody style={{ color: INK }}>
              <tr style={{ borderTop: `1px solid ${LINE}` }}>
                <td className="py-2.5">jamie@—store.com <StatusPill tone="neutral" accent={accent}>Sample</StatusPill></td>
                <td className="py-2.5">52 / 100</td>
                <td className="py-2.5">Margin visibility</td>
                <td className="py-2.5">—</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[13px]" style={{ color: DIM }}>Leads land here the moment someone completes it. Yours to keep, exportable anytime.</p>
      </div>
    </div>
  );
}

// ---------- Strategy surface ----------
function StrategySurface({ board, accent }: { board: Board; accent: string }) {
  const strat = board.strategy;
  const [open, setOpen] = useState<string | null>(null);
  const [shiftOpen, setShiftOpen] = useState(false);
  const [shiftSent, setShiftSent] = useState(false);
  const [note, setNote] = useState('');
  if (!strat) return null;

  const openPillar = strat.pillars.find((p) => p.key === open);
  const queueOf = (key: string) => board.queue.filter((q) => q.pillar === key);
  const scheduledOf = (key: string) => (board.calendar?.items || []).filter((it) => it.pillar === key).length;

  return (
    <div>
      <SectionHead title="Your content strategy" sub="One plan, divided on purpose. Your operator holds the mix; you can request a shift anytime." />

      <div className="rounded-[14px] bg-white p-4 sm:p-6" style={{ border: `1px solid ${LINE}`, boxShadow: CARD_SHADOW }}>
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <div className="text-[12px] font-semibold uppercase tracking-[0.1em]" style={{ color: FAINT }}>
            Your content this month
          </div>
          <div className="flex items-baseline gap-2">
            <span style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 34, lineHeight: 1, color: INK }}>{strat.total}</span>
            <span className="text-[13px] font-medium" style={{ color: DIM }}>posts</span>
          </div>
        </div>

        <div className="flex w-full overflow-hidden rounded-lg" style={{ border: `1px solid ${LINE}` }}>
          {strat.pillars.map((p, i) => (
            <button
              key={p.key}
              onClick={() => setOpen(open === p.key ? null : p.key)}
              className="relative flex min-h-[86px] flex-col items-start justify-center gap-0.5 px-2 py-3 text-left transition-opacity"
              style={{
                flexGrow: p.pct,
                flexBasis: 0,
                minWidth: 58,
                background: `color-mix(in srgb, ${accent} ${TINT_STEPS[i % TINT_STEPS.length]}%, white)`,
                borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.9)' : 'none',
                opacity: open && open !== p.key ? 0.55 : 1,
              }}
            >
              <span className="w-full truncate text-[12px] font-semibold" style={{ color: INK }}>{p.label}</span>
              <span style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 24, lineHeight: 1.05, color: INK }}>{p.count}</span>
              <span className="text-[11px] font-medium" style={{ color: DIM }}>{p.pct}%</span>
            </button>
          ))}
        </div>

        {openPillar && (
          <div className="mt-5 rounded-lg p-4" style={{ background: '#fbfcfd', border: `1px solid ${LINE}` }}>
            <div className="text-[14px] font-semibold" style={{ color: INK }}>{openPillar.label}</div>
            {openPillar.blurb && <p className="mt-1 text-[13px] leading-relaxed" style={{ color: DIM }}>{openPillar.blurb}</p>}
            <div className="mt-3 flex flex-col gap-3">
              {queueOf(openPillar.key).map((q) => (
                <div key={q.id} className="rounded-lg bg-white p-3" style={{ border: `1px solid ${LINE}` }}>
                  <div className="text-[13px] font-medium leading-snug" style={{ color: INK }}>{q.hook || q.title}</div>
                  <div className="mt-1 text-[12px]" style={{ color: FAINT }}>In your review · publishes {fmtDay(q.publish_date)}</div>
                </div>
              ))}
            </div>
            {scheduledOf(openPillar.key) > 0 && (
              <p className="mt-3 text-[12px]" style={{ color: FAINT }}>
                + {scheduledOf(openPillar.key)} more {openPillar.label.toLowerCase()} slots scheduled in {strat.period || 'this month'}
              </p>
            )}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            onClick={() => { setShiftOpen(!shiftOpen); setShiftSent(false); }}
            className="inline-flex min-h-[44px] items-center rounded-lg px-4 text-[14px] font-semibold"
            style={{ border: `1px solid ${LINE}`, color: INK, background: '#fff' }}
          >
            Request a shift
          </button>
          {shiftSent && <span className="text-[13px] font-medium" style={{ color: '#047857' }}>Sent. Your operator reviews every shift.</span>}
        </div>
        {shiftOpen && !shiftSent && (
          <div className="mt-3">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder='e.g. "More proof posts this month, we just landed two big results."'
              rows={3}
              className="w-full rounded-lg p-3 text-[14px] outline-none"
              style={{ border: `1px solid ${LINE}`, color: INK, background: '#fbfcfd' }}
            />
            <button
              onClick={() => { setShiftSent(true); setShiftOpen(false); }}
              className="mt-2 inline-flex min-h-[44px] items-center rounded-lg px-4 text-[14px] font-semibold"
              style={{ border: `1px solid ${LINE}`, color: INK, background: '#fff' }}
            >
              Send
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- page ----------
const TABS = [
  { id: 'review', label: 'Review' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'lm', label: 'Lead magnet' },
  { id: 'strategy', label: 'Strategy' },
] as const;
type TabId = (typeof TABS)[number]['id'];

export default function ClientBoardPage() {
  const { slug } = useParams<{ slug: string }>();
  const [params] = useSearchParams();
  const token = params.get('k') || '';
  const [board, setBoard] = useState<Board | null>(null);
  const [mode, setMode] = useState<string>('demo');
  const [state, setState] = useState<'loading' | 'ready' | 'invalid'>('loading');
  const [tab, setTab] = useState<TabId>('review');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!slug || !token) { setState('invalid'); return; }
      const { data, error } = await supabase.rpc('get_client_board', { p_slug: slug, p_token: token });
      if (cancelled) return;
      if (error || !data) { setState('invalid'); return; }
      setBoard((data as any).board as Board);
      setMode((data as any).mode || 'demo');
      setState('ready');
    })();
    return () => { cancelled = true; };
  }, [slug, token]);

  // Load the client's heading font so the board carries their type, not ours.
  const headingFont = board?.brand?.font_heading;
  useEffect(() => {
    if (!headingFont) return;
    const id = 'client-board-font';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(headingFont).replace(/%20/g, '+')}:wght@400;600;700&display=swap`;
    document.head.appendChild(link);
  }, [headingFont]);

  const accent = cleanHex(board?.brand?.accent_hex);

  if (state === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: '#f6f7f9' }}>
        <div className="text-[14px]" style={{ color: FAINT }}>Loading your board…</div>
      </div>
    );
  }
  if (state === 'invalid' || !board) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6" style={{ background: '#f6f7f9' }}>
        <div className="max-w-sm rounded-[14px] bg-white p-8 text-center" style={{ border: `1px solid ${LINE}`, boxShadow: CARD_SHADOW }}>
          <div className="text-[16px] font-semibold" style={{ color: INK }}>This preview link isn't valid or has expired.</div>
          <p className="mt-2 text-[14px]" style={{ color: DIM }}>Ask Ivan for a fresh link.</p>
        </div>
      </div>
    );
  }

  const fontStack = headingFont ? `"${headingFont}", Inter, system-ui, sans-serif` : 'Inter, system-ui, sans-serif';
  const surfaces: Record<TabId, React.ReactNode> = {
    review: <ReviewSurface board={board} accent={accent} />,
    calendar: <CalendarSurface board={board} accent={accent} />,
    lm: <LeadMagnetSurface board={board} accent={accent} />,
    strategy: <StrategySurface board={board} accent={accent} />,
  };

  const nav = (vertical: boolean) => (
    <nav className={vertical ? 'flex flex-col gap-1' : 'grid w-full grid-cols-4'} aria-label="Board sections">
      {TABS.map((t) => {
        const active = tab === t.id;
        return (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); window.scrollTo({ top: 0 }); }}
            className={`min-h-[44px] rounded-lg text-[13px] font-semibold transition-colors ${vertical ? 'px-3 text-left' : 'px-1 text-center'}`}
            style={active
              ? { background: `color-mix(in srgb, ${accent} 12%, white)`, color: INK }
              : { color: DIM, background: 'transparent' }}
          >
            {t.label}
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen" style={{ background: '#f6f7f9', color: INK, fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col gap-6 border-r bg-white p-5 lg:flex" style={{ borderColor: LINE }}>
        <div>
          <div className="flex items-center gap-2.5">
            {board.logo_url && (
              <img src={board.logo_url} alt="" className="h-8 w-8 rounded object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
            )}
            <div className="min-w-0">
              <div className="truncate text-[14px] font-semibold" style={{ fontFamily: fontStack }}>{board.company_name}</div>
              <div className="text-[11px] font-medium uppercase tracking-[0.08em]" style={{ color: FAINT }}>Content engine</div>
            </div>
          </div>
        </div>
        {nav(true)}
        <div className="mt-auto flex flex-col gap-3">
          {mode === 'demo' && (
            <div className="rounded-lg px-3 py-2 text-[12px] font-medium leading-snug" style={{ background: '#f1f5f9', color: DIM }}>
              Preview built for {board.company_name}
            </div>
          )}
          <div className="text-[11px]" style={{ color: FAINT }}>Run by Ivan Manfredi</div>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-20 flex items-center gap-2.5 border-b bg-white px-4 py-3 lg:hidden" style={{ borderColor: LINE }}>
        {board.logo_url && (
          <img src={board.logo_url} alt="" className="h-7 w-7 rounded object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
        )}
        <div className="min-w-0">
          <div className="truncate text-[14px] font-semibold" style={{ fontFamily: fontStack }}>{board.company_name}</div>
        </div>
        {mode === 'demo' && (
          <span className="ml-auto rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: '#f1f5f9', color: DIM }}>Preview</span>
        )}
      </header>

      <main className="px-4 pb-28 pt-6 sm:px-6 lg:ml-60 lg:px-10 lg:pb-16 lg:pt-10">
        <div className="mx-auto w-full max-w-3xl">{surfaces[tab]}</div>
      </main>

      {/* Mobile bottom tabs */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-white px-2 py-1.5 lg:hidden" style={{ borderColor: LINE }}>
        {nav(false)}
      </div>
    </div>
  );
}
