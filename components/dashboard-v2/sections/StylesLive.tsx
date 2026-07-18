import React, { useEffect, useMemo, useState } from 'react';
import '../editorial-cockpit.css';
import { supabase } from '../../../lib/supabase';
import { pillarMixTargets } from '../../../lib/strategyConfig';

/**
 * Styles (live) — the alive-layer replacement for the static Style Gallery.
 *
 * Round-3 verdict root-cause: "styles don't update". This surface reads the
 * canonical registry LIVE instead of a hardcoded catalogue:
 *   · every active style-% row in content_prompts (slug, title, updated_at, a
 *     blurb lifted from the prompt body) — the 11 carousel/image styles.
 *   · the live pillar taxonomy: the target mix (30/25/15/20/10, from
 *     brand-positioning strategy) beside ACTUAL published counts pulled from
 *     carousel_drafts.taxonomy over a rolling 30-day window.
 *
 * Black Box white-paper register (matches Today/Pulse). Hairlines only,
 * functional labels, hover states. If a read is RLS-blocked or errors, the
 * surface says so honestly — never a hardcoded fallback list.
 */

const PILLAR_ORDER = ['Translator', 'Methodology', 'Teardown', 'Case Study', 'Personal'];
const PILLAR_WINDOW_DAYS = 30;
const RECENT_DAYS = 7;

interface StyleRow {
  slug: string;
  title: string;
  blurb: string | null;
  updatedAt: string;
}

/** Lift the first ~2 meaningful lines of a prompt body as a human blurb. */
function bodyBlurb(body: string | null | undefined): string | null {
  if (!body) return null;
  const lines = body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && !l.startsWith('```') && !l.startsWith('---'));
  if (lines.length === 0) return null;
  const text = lines.slice(0, 2).join(' ').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  return text.length > 180 ? text.slice(0, 177) + '…' : text;
}

function normalizePillar(raw: unknown): string {
  if (typeof raw !== 'string') return 'Other';
  const k = raw.trim().toLowerCase().replace(/[_-]+/g, ' ');
  return PILLAR_ORDER.find((p) => p.toLowerCase() === k) ?? 'Other';
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isRecent(iso: string): boolean {
  const t = new Date(iso).getTime();
  return !isNaN(t) && Date.now() - t <= RECENT_DAYS * 86400000;
}

/** Drift band: |actual-target|/target — symmetric so over/under both flag. */
function mixStatus(actual: number, target: number): 'ok' | 'warn' | 'off' {
  if (!target) return 'ok';
  const rel = Math.abs(actual - target) / target;
  return rel <= 0.25 ? 'ok' : rel <= 0.5 ? 'warn' : 'off';
}

const BAND_COLOR: Record<'ok' | 'warn' | 'off', string> = {
  ok: 'var(--ec-ink)',
  warn: '#8A6D1B',
  off: 'var(--ec-red)',
};

export function StylesLive() {
  const [styles, setStyles] = useState<StyleRow[] | null>(null);
  const [stylesErr, setStylesErr] = useState<string | null>(null);
  const [tax, setTax] = useState<{ pillar: string; count: number }[] | null>(null);
  const [taxErr, setTaxErr] = useState<string | null>(null);
  const [taxTotal, setTaxTotal] = useState(0);

  // Live style registry
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from('content_prompts')
        .select('slug, title, body, updated_at')
        .like('slug', 'style-%')
        .eq('is_active', true)
        .order('slug', { ascending: true });
      if (!alive) return;
      if (error) {
        setStylesErr(error.message);
        setStyles([]);
        return;
      }
      setStylesErr(null);
      setStyles(
        (data || []).map((r: any) => ({
          slug: r.slug as string,
          title: (r.title as string) || (r.slug as string),
          blurb: bodyBlurb(r.body as string),
          updatedAt: r.updated_at as string,
        })),
      );
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Live pillar taxonomy — actual counts from carousel_drafts (30d published)
  useEffect(() => {
    let alive = true;
    (async () => {
      const since = new Date(Date.now() - PILLAR_WINDOW_DAYS * 86400000).toISOString();
      const { data, error } = await supabase
        .from('carousel_drafts')
        .select('taxonomy, updated_at')
        .eq('status', 'published')
        .gt('updated_at', since)
        .limit(500);
      if (!alive) return;
      if (error) {
        setTaxErr(error.message);
        setTax([]);
        return;
      }
      const counts: Record<string, number> = {};
      let total = 0;
      for (const r of data || []) {
        const p = normalizePillar((r as any).taxonomy?.pillar);
        counts[p] = (counts[p] || 0) + 1;
        total += 1;
      }
      setTaxErr(null);
      setTaxTotal(total);
      setTax(PILLAR_ORDER.map((p) => ({ pillar: p, count: counts[p] || 0 })));
    })();
    return () => {
      alive = false;
    };
  }, []);

  const targetOf = (pillar: string) =>
    pillarMixTargets.find((p) => p.pillar === pillar)?.targetPct ?? 0;

  const styleCount = styles?.length ?? 0;
  const recentCount = useMemo(
    () => (styles || []).filter((s) => isRecent(s.updatedAt)).length,
    [styles],
  );

  return (
    <div className="ec">
      <div className="ec-topline">
        <span className="ec-topline-brand">Styles · live registry</span>
        <span className="ec-topline-meta">
          content_prompts · {styles === null ? '…' : `${styleCount} active`}
          {recentCount > 0 ? ` · ${recentCount} updated ≤7d` : ''}
        </span>
      </div>

      <h1 className="ec-hed ec-hed--today">Styles</h1>

      {/* ── Style registry ─────────────────────────────────────────────── */}
      <div className="ec-kicker" style={{ marginBottom: '0.4rem' }}>
        Visual style set
        <span className="ec-kicker-count">{styles === null ? '·' : styleCount}</span>
      </div>

      {styles === null ? (
        <p className="ec-note">reading content_prompts…</p>
      ) : stylesErr ? (
        <span className="ec-offline" title={stylesErr}>
          no access · content_prompts read blocked
        </span>
      ) : styleCount === 0 ? (
        <p className="ec-note">no active style rows in the registry.</p>
      ) : (
        <div className="ec-list">
          {styles.map((s) => (
            <div
              className="ec-item ec-item--hover"
              key={s.slug}
              style={{ alignItems: 'flex-start', gap: '1rem', padding: '0.75rem 0' }}
              title={s.slug}
            >
              <div className="ec-item-body" style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <span className="ec-item-title">{s.title}</span>
                  {isRecent(s.updatedAt) && (
                    <span
                      style={{
                        fontSize: 9.5,
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        color: 'var(--ec-ink)',
                        border: '1px solid var(--ec-ink)',
                        padding: '0.05rem 0.3rem',
                      }}
                    >
                      updated
                    </span>
                  )}
                </div>
                <div className="ec-item-meta" style={{ marginTop: 2 }}>{s.slug}</div>
                <div
                  className="ec-note"
                  style={{ marginTop: '0.35rem', fontStyle: s.blurb ? undefined : 'italic', color: s.blurb ? undefined : 'var(--ec-dim)' }}
                >
                  {s.blurb ?? 'no description in registry'}
                </div>
              </div>
              <div style={{ flex: '0 0 auto', textAlign: 'right' }}>
                <div className="ec-data">updated</div>
                <div className="ec-data" style={{ color: 'var(--ec-ink)' }}>{fmtDate(s.updatedAt)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <hr className="ec-rule ec-rule--strong" />

      {/* ── Pillar taxonomy: target mix vs actual ──────────────────────── */}
      <div className="ec-kicker" style={{ marginBottom: '0.4rem' }}>
        Pillar taxonomy · target vs actual
        <span className="ec-kicker-count">{taxTotal} published · {PILLAR_WINDOW_DAYS}d</span>
      </div>

      {tax === null ? (
        <p className="ec-note">reading carousel_drafts…</p>
      ) : taxErr ? (
        <span className="ec-offline" title={taxErr}>
          no access · carousel_drafts read blocked
        </span>
      ) : (
        <div style={{ marginTop: '0.5rem' }}>
          {tax.map((row) => {
            const actualPct = taxTotal ? Math.round((row.count / taxTotal) * 100) : 0;
            const target = targetOf(row.pillar);
            const band = mixStatus(actualPct, target);
            return (
              <div
                key={row.pillar}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.9rem',
                  padding: '0.55rem 0',
                  borderBottom: '1px solid var(--ec-rule)',
                }}
              >
                <span style={{ flex: '0 0 130px', fontSize: 13, fontWeight: 600, color: 'var(--ec-ink)' }}>
                  {row.pillar}
                </span>
                <div style={{ flex: '1 1 auto', position: 'relative', height: 10, background: 'rgba(19,18,16,0.06)', minWidth: 80 }}>
                  {/* target marker */}
                  <span style={{ position: 'absolute', top: -2, bottom: -2, width: 1, background: 'var(--ec-mutedc)', left: `${target}%` }} title={`Target ${target}%`} />
                  {/* actual fill */}
                  <span style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${Math.min(actualPct, 100)}%`, background: BAND_COLOR[band] }} />
                </div>
                <span className="ec-data" style={{ flex: '0 0 118px', textAlign: 'right', color: BAND_COLOR[band] }}>
                  {actualPct}% / {target}% · n={row.count}
                </span>
              </div>
            );
          })}
          {taxTotal === 0 && (
            <p className="ec-note" style={{ marginTop: '0.6rem' }}>
              No published posts in the last {PILLAR_WINDOW_DAYS} days — actuals read 0.
            </p>
          )}
          <div className="ec-data" style={{ marginTop: '0.7rem', color: 'var(--ec-mutedc)' }}>
            Target mix from brand-positioning · actuals live from carousel_drafts.taxonomy.pillar
          </div>
        </div>
      )}
    </div>
  );
}

export default StylesLive;
