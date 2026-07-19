import { Fragment, useMemo, useState } from 'react';
import { useClaudeUsage, UsageSession } from '../../../../hooks/useClaudeUsage';
import '../../editorial-cockpit.css';
import './usage/usage.css';

/**
 * Usage — Claude usage analytics, rebuilt in BLACK BOX v4 (founder correction
 * 2026-07-18). The founder PRAISED this panel's density, so the brief is a
 * "printed financial report": dense tabular figures, hairline rules, section
 * numbering, a terminal masthead. Every hue in the v1 dark panel (model
 * purple/cyan/emerald, 6-colour session-kind palette, blue/purple daily stack,
 * amber outlier, 4-colour token-mix) is re-expressed in INK ONLY, carried by
 * fill pattern (solid / hatch / cross / dots / vert / horiz / outline), weight
 * and functional labels. No Signal red is spent: a cost outlier is a
 * noteworthy anomaly, not danger, so it wears an ink box + bold flag.
 *
 * Data (unchanged): hooks/useClaudeUsage.ts — 3 RPCs, 60s poll. Read-only.
 * The single interactive element is the click-to-expand session row.
 */

const MAX_PLAN_USD = 200;

function fmtTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${Math.round(n)}`;
}
function fmtCost(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toFixed(2)}`;
}
function fmtNum(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${n}`;
}
function shortProject(p: string): string {
  return p.replace(/^\/Users\/[^/]+\//, '~/').replace(/^\/private\/tmp\//, '/tmp/');
}
function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

// ── Ink pattern language: every categorical colour becomes a fill pattern ────
const KIND_META: Record<string, { label: string; pat: string; tip: string }> = {
  'subagent-orchestrator': { label: 'Subagent Orchestrator', pat: 'u-pat--solid', tip: '5+ Agent dispatches, heavy delegation' },
  'heavy-implementation':  { label: 'Heavy Implementation',  pat: 'u-pat--hatch', tip: '30+ edits/writes, building or refactoring' },
  'long-conversation':     { label: 'Long Conversation (rot risk)', pat: 'u-pat--horiz', tip: '85%+ cache reads + 50+ messages, re-reading dominates. /compact or /clear' },
  'research-heavy':        { label: 'Research-Heavy',        pat: 'u-pat--cross', tip: '30+ Reads, few edits, exploration or analysis' },
  'exploration':           { label: 'Exploration',           pat: 'u-pat--vert', tip: '30+ Bash commands, shell-driven' },
  'mixed':                 { label: 'Mixed',                 pat: 'u-pat--outline', tip: 'No dominant pattern' },
};
function kindMeta(kind: string | null) {
  const k = kind ?? 'mixed';
  return KIND_META[k] ?? KIND_META['mixed'];
}
function modelPat(m: string): string {
  if (m.startsWith('claude-opus')) return 'u-pat--solid';
  if (m.startsWith('claude-sonnet')) return 'u-pat--hatch';
  if (m.startsWith('claude-haiku')) return 'u-pat--dots';
  return 'u-pat--outline';
}

function topTools(counts: Record<string, number>, n = 3): { name: string; count: number }[] {
  return Object.entries(counts)
    .map(([name, count]) => ({ name: name.replace(/^mcp__/, ''), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

function zScores(sessions: UsageSession[]): Map<string, number> {
  const map = new Map<string, number>();
  if (sessions.length < 5) return map;
  const costs = sessions.map((s) => Number(s.estimated_cost));
  const mean = costs.reduce((a, b) => a + b, 0) / costs.length;
  const variance = costs.reduce((a, b) => a + (b - mean) ** 2, 0) / costs.length;
  const sd = Math.sqrt(variance);
  if (sd === 0) return map;
  for (const s of sessions) map.set(s.id, (Number(s.estimated_cost) - mean) / sd);
  return map;
}

function SecHead({ no, title, sub }: { no: string; title: string; sub?: string }) {
  return (
    <div className="u-sec">
      <span className="u-sec-no">{no}</span>
      <span className="u-sec-t">{title}</span>
      {sub && <span className="u-sec-sub">{sub}</span>}
    </div>
  );
}

export default function UsageRebuilt() {
  const { sessions, daily, projects, loading, error } = useClaudeUsage();
  const [openSession, setOpenSession] = useState<string | null>(null);

  const last30dCost = useMemo(
    () => sessions.reduce((a, b) => a + Number(b.estimated_cost), 0),
    [sessions],
  );
  const last7dCost = useMemo(() => {
    const cutoff = Date.now() - 7 * 86400_000;
    return sessions
      .filter((s) => new Date(s.started_at).getTime() >= cutoff)
      .reduce((a, b) => a + Number(b.estimated_cost), 0);
  }, [sessions]);
  const last7dSessions = useMemo(
    () => sessions.filter((s) => new Date(s.started_at).getTime() >= Date.now() - 7 * 86400_000).length,
    [sessions],
  );
  const leverage = last30dCost / MAX_PLAN_USD;
  const denom = last30dCost || 1;

  const byModel = useMemo(() => {
    const m = new Map<string, { cost: number; tokens: number; sessions: number }>();
    for (const s of sessions) {
      const e = m.get(s.primary_model) ?? { cost: 0, tokens: 0, sessions: 0 };
      e.cost += Number(s.estimated_cost);
      e.tokens += s.total_tokens;
      e.sessions += 1;
      m.set(s.primary_model, e);
    }
    return [...m.entries()].sort((a, b) => b[1].cost - a[1].cost);
  }, [sessions]);

  const byKind = useMemo(() => {
    const m = new Map<string, { cost: number; sessions: number }>();
    for (const s of sessions) {
      const k = s.session_kind ?? 'mixed';
      const e = m.get(k) ?? { cost: 0, sessions: 0 };
      e.cost += Number(s.estimated_cost);
      e.sessions += 1;
      m.set(k, e);
    }
    return [...m.entries()].sort((a, b) => b[1].cost - a[1].cost);
  }, [sessions]);

  const tokenMix = useMemo(() => {
    let inp = 0, out = 0, cr = 0, cw = 0;
    for (const s of sessions) {
      inp += s.input_tokens; out += s.output_tokens;
      cr += s.cache_read_tokens; cw += s.cache_write_tokens;
    }
    const total = inp + out + cr + cw || 1;
    return {
      input: { tokens: inp, pct: (inp / total) * 100 },
      output: { tokens: out, pct: (out / total) * 100 },
      cacheRead: { tokens: cr, pct: (cr / total) * 100 },
      cacheWrite: { tokens: cw, pct: (cw / total) * 100 },
    };
  }, [sessions]);

  const aggregateToolCounts = useMemo(() => {
    const counts: Record<string, { calls: number; cost: number }> = {};
    for (const s of sessions) {
      const tools = s.tool_call_counts ?? {};
      const totalCallsInSession = Object.values(tools).reduce((a, b) => a + (b as number), 0) || 1;
      for (const [tool, c] of Object.entries(tools)) {
        const name = tool.replace(/^mcp__/, '');
        const e = counts[name] ?? { calls: 0, cost: 0 };
        e.calls += c as number;
        e.cost += Number(s.estimated_cost) * ((c as number) / totalCallsInSession);
        counts[name] = e;
      }
    }
    return Object.entries(counts)
      .map(([name, v]) => ({ name, calls: v.calls, cost: v.cost }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 12);
  }, [sessions]);

  const zMap = useMemo(() => zScores(sessions), [sessions]);
  const topSessions = useMemo(
    () => [...sessions].sort((a, b) => Number(b.estimated_cost) - Number(a.estimated_cost)).slice(0, 20),
    [sessions],
  );

  if (loading) return <div className="ec"><div className="u-state">Loading usage…</div></div>;
  if (error) return <div className="ec"><div className="u-state u-state--err">Error: {error}</div></div>;

  const topModel = byModel[0];
  const topKind = byKind[0];
  const toolMaxPct = Math.max(1, ...aggregateToolCounts.map((t) => (t.cost / denom) * 100));

  return (
    <div className="ec">
      {/* Document header */}
      <div className="ec-topline">
        <span className="ec-topline-brand">Usage</span>
        <span className="ec-topline-meta">
          Claude Code · 30-day window · {sessions.length} sessions · polls 60s
        </span>
      </div>
      <h1 className="ec-hed ec-hed--today">Usage</h1>
      <p className="u-intro">
        Costs are API-rate equivalent. Your Max plan bills <strong>${MAX_PLAN_USD}/mo flat</strong>, so the
        30-day figure is the leverage you would otherwise pay for. Sessions are auto-classified by tool pattern.
        Long-conversation sessions burn tokens re-reading old context (the "rot"). Series are ink-coded by fill
        pattern, not colour.
      </p>

      {/* §1 Summary masthead */}
      <SecHead no="§1" title="Summary" sub="Trailing 30 days unless noted" />
      <div className="u-mast">
        <div className="u-mast-cell">
          <div className="u-mast-lbl">30d API equivalent</div>
          <div className="u-mast-fig" title={fmtCost(last30dCost)}>{fmtCost(last30dCost)}</div>
          <div className="u-mast-sub">{leverage >= 10 ? leverage.toFixed(0) : leverage.toFixed(1)}× your ${MAX_PLAN_USD} plan</div>
        </div>
        <div className="u-mast-cell">
          <div className="u-mast-lbl">7d API equivalent</div>
          <div className="u-mast-fig" title={fmtCost(last7dCost)}>{fmtCost(last7dCost)}</div>
          <div className="u-mast-sub">{last7dSessions} sessions</div>
        </div>
        <div className="u-mast-cell">
          <div className="u-mast-lbl">Top model</div>
          <div className="u-mast-fig" title={topModel?.[0] ?? '-'}>{topModel?.[0]?.replace('claude-', '') ?? '-'}</div>
          <div className="u-mast-sub">
            {topModel ? `${fmtCost(topModel[1].cost)} · ${((topModel[1].cost / denom) * 100).toFixed(0)}% of spend` : ''}
          </div>
        </div>
        <div className="u-mast-cell">
          <div className="u-mast-lbl">Top session kind</div>
          <div className="u-mast-fig" style={{ fontSize: 'clamp(19px, 1.7vw, 24px)', whiteSpace: 'normal', lineHeight: 1.05 }} title={topKind ? kindMeta(topKind[0]).label : '-'}>
            {topKind ? kindMeta(topKind[0]).label : '-'}
          </div>
          <div className="u-mast-sub">{topKind ? `${fmtCost(topKind[1].cost)} · ${topKind[1].sessions} sessions` : ''}</div>
        </div>
      </div>

      {/* §2 Daily spend */}
      <SecHead no="§2" title="Daily spend, 30 days" sub="API-rate equivalent per day, stacked local + railway. Hover a column for the day total." />
      <DailyBars daily={daily} />

      {/* §3–§6 breakdowns */}
      <div className="u-grid2">
        {/* §3 By session kind */}
        <div>
          <SecHead no="§3" title="By session kind" sub="What you do when you burn tokens" />
          <div className="u-bars">
            {byKind.map(([kind, v]) => {
              const meta = kindMeta(kind);
              const pct = (v.cost / denom) * 100;
              return (
                <div className="u-bar" key={kind} title={meta.tip}>
                  <span className="u-bar-lbl">
                    <span className={`u-sw ${meta.pat}`} />
                    <span className="u-bar-lbl-txt">{meta.label}</span>
                  </span>
                  <span className="u-bar-val">{fmtCost(v.cost)} <span className="u-bar-pct">· {pct.toFixed(0)}% · {v.sessions}s</span></span>
                  <span className="u-track"><span className={`u-fill ${meta.pat}`} style={{ width: `${Math.min(pct, 100)}%` }} /></span>
                </div>
              );
            })}
          </div>
        </div>

        {/* §4 By model */}
        <div>
          <SecHead no="§4" title="By model" sub="Opus output ≈ 5× sonnet, 15× haiku per token" />
          <div className="u-bars">
            {byModel.map(([model, v]) => {
              const pct = (v.cost / denom) * 100;
              const pat = modelPat(model);
              return (
                <div className="u-bar" key={model}>
                  <span className="u-bar-lbl">
                    <span className={`u-sw ${pat}`} />
                    <span className="u-bar-lbl-txt u-fig">{model.replace('claude-', '')}</span>
                  </span>
                  <span className="u-bar-val">{fmtCost(v.cost)} <span className="u-bar-pct">· {pct.toFixed(0)}% · {v.sessions}s</span></span>
                  <span className="u-track"><span className={`u-fill ${pat}`} style={{ width: `${Math.min(pct, 100)}%` }} /></span>
                </div>
              );
            })}
          </div>
        </div>

        {/* §5 Token mix */}
        <div>
          <SecHead no="§5" title="Token mix" sub="High cache-read = long re-reading sessions; high cache-write = new context" />
          <div className="u-tok">
            <TokenRow label="Cache reads (re-read history)" pat="u-pat--solid" tokens={tokenMix.cacheRead.tokens} pct={tokenMix.cacheRead.pct} />
            <TokenRow label="Cache writes (new context)" pat="u-pat--hatch" tokens={tokenMix.cacheWrite.tokens} pct={tokenMix.cacheWrite.pct} />
            <TokenRow label="Output (model wrote)" pat="u-pat--cross" tokens={tokenMix.output.tokens} pct={tokenMix.output.pct} />
            <TokenRow label="Fresh input" pat="u-pat--outline" tokens={tokenMix.input.tokens} pct={tokenMix.input.pct} />
          </div>
        </div>

        {/* §6 Top tools */}
        <div>
          <SecHead no="§6" title="Top tools by cost share" sub="Session cost split across its tools; Agent dispatches stand out" />
          <div className="u-bars">
            {aggregateToolCounts.map((t) => {
              const pct = (t.cost / denom) * 100;
              return (
                <div className="u-bar" key={t.name}>
                  <span className="u-bar-lbl">
                    <span className="u-bar-lbl-txt u-fig">{t.name}</span>
                  </span>
                  <span className="u-bar-val">{fmtNum(t.calls)} calls · {fmtCost(t.cost)}</span>
                  <span className="u-track"><span className="u-fill u-pat--solid" style={{ width: `${Math.min((pct / toolMaxPct) * 100, 100)}%` }} /></span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* §7 By project */}
      <SecHead no="§7" title="By project, 30 days" sub={`${projects.length} projects, top 12 by API-equivalent cost`} />
      <div className="u-tablewrap">
        <table className="u-table">
          <thead>
            <tr>
              <th>Project</th>
              <th>Source</th>
              <th className="u-r">Sessions</th>
              <th className="u-r">Tokens</th>
              <th className="u-r">API equiv</th>
              <th className="u-r">Last</th>
            </tr>
          </thead>
          <tbody>
            {projects.slice(0, 12).map((p, i) => (
              <tr key={i}>
                <td className="u-proj" title={p.project_path}>{shortProject(p.project_path)}</td>
                <td><SourceBadge source={p.source} /></td>
                <td className="u-num u-r u-dim">{p.session_count}</td>
                <td className="u-num u-r u-dim">{fmtTokens(p.total_tokens)}</td>
                <td className="u-num u-r">{fmtCost(Number(p.estimated_cost))}</td>
                <td className="u-num u-r u-dim">{timeAgo(p.last_session)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* §8 Top sessions */}
      <SecHead no="§8" title="Top 20 sessions by cost" sub="Click a row for the first prompt and tool breakdown. Outliers (z ≥ 2σ) boxed." />
      <div className="u-tablewrap">
        <table className="u-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Project</th>
              <th>Kind</th>
              <th>Model</th>
              <th className="u-r" title="User prompts you sent">Prompts</th>
              <th className="u-r" title="Model API calls; each tool round-trip is a turn">Turns</th>
              <th className="u-r">Tokens</th>
              <th className="u-r">API equiv</th>
              <th className="u-r">σ</th>
            </tr>
          </thead>
          <tbody>
            {topSessions.map((s) => {
              const z = zMap.get(s.id) ?? 0;
              const isOutlier = z >= 2;
              const isOpen = openSession === s.id;
              const meta = kindMeta(s.session_kind);
              const tools = topTools(s.tool_call_counts ?? {}, 5);
              const turnsPerPrompt = s.user_prompt_count > 0 ? s.turn_count / s.user_prompt_count : 0;
              return (
                <Fragment key={s.id}>
                  <tr
                    className={`u-clickable ${isOpen ? 'u-open' : ''}`}
                    onClick={() => setOpenSession(isOpen ? null : s.id)}
                  >
                    <td className="u-num u-dim">{timeAgo(s.started_at)}</td>
                    <td className="u-proj" title={s.project_path} style={{ maxWidth: 200 }}>{shortProject(s.project_path)}</td>
                    <td><span className="u-kind"><span className={`u-sw ${meta.pat}`} />{meta.label.split(' ')[0]}</span></td>
                    <td><span className="u-model">{s.primary_model.replace('claude-', '')}</span></td>
                    <td className="u-num u-r">{fmtNum(s.user_prompt_count)}</td>
                    <td className="u-num u-r u-dim" title={turnsPerPrompt > 0 ? `${turnsPerPrompt.toFixed(1)}× per prompt` : undefined}>{fmtNum(s.turn_count)}</td>
                    <td className="u-num u-r u-dim">{fmtTokens(s.total_tokens)}</td>
                    <td className="u-num u-r" style={{ fontWeight: 700 }}>{fmtCost(Number(s.estimated_cost))}</td>
                    <td className="u-r">
                      <span className={isOutlier ? 'u-sigma u-sigma--flag' : 'u-sigma'}>{z.toFixed(1)}σ</span>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="u-detail">
                      <td colSpan={9}>
                        <div className="u-detail-in">
                          <div>
                            <div className="u-d-lbl">First prompt</div>
                            {s.first_user_message ? (
                              <div className="u-d-prompt">
                                {s.first_user_message.length > 400 ? s.first_user_message.slice(0, 400) + '…' : s.first_user_message}
                              </div>
                            ) : (
                              <div className="u-d-prompt u-d-prompt--none">No plain-text user prompt found.</div>
                            )}
                          </div>
                          <div className="u-d-grid">
                            <div className="u-d-block">
                              <div className="u-d-lbl">Top tools</div>
                              <div className="u-d-chips">
                                {tools.length === 0 ? (
                                  <span className="u-d-val">no tool calls</span>
                                ) : (
                                  tools.map((t) => (
                                    <span className="u-d-chip" key={t.name}>{t.name}<span className="u-d-chip-n">×{t.count}</span></span>
                                  ))
                                )}
                              </div>
                            </div>
                            <div className="u-d-block">
                              <div className="u-d-lbl">Conversation shape</div>
                              <div className="u-d-val">
                                {fmtNum(s.user_prompt_count)} prompts → {fmtNum(s.turn_count)} model calls{turnsPerPrompt > 0 ? ` (${turnsPerPrompt.toFixed(1)}× per prompt)` : ''}
                              </div>
                            </div>
                            <div className="u-d-block">
                              <div className="u-d-lbl">Token shape</div>
                              <div className="u-d-val">
                                in {fmtTokens(s.input_tokens)} · out {fmtTokens(s.output_tokens)} · cache↓ {fmtTokens(s.cache_read_tokens)} · cache↑ {fmtTokens(s.cache_write_tokens)}
                              </div>
                            </div>
                            <div className="u-d-block">
                              <div className="u-d-lbl">Why {meta.label.toLowerCase()}{isOutlier ? ` · ${z.toFixed(1)}σ outlier` : ''}</div>
                              <div className="u-d-why">{meta.tip}{isOutlier ? ` This session's cost sits ${z.toFixed(1)} standard deviations above the 30-day mean.` : ''}</div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TokenRow({ label, pat, tokens, pct }: { label: string; pat: string; tokens: number; pct: number }) {
  return (
    <div className="u-tok-row">
      <div className="u-tok-head">
        <span className="u-tok-lbl"><span className={`u-sw ${pat}`} />{label}</span>
        <span className="u-tok-val">{fmtTokens(tokens)} · {pct.toFixed(1)}%</span>
      </div>
      <div className="u-tok-track"><span className={`u-fill ${pat}`} style={{ width: `${Math.min(pct, 100)}%` }} /></div>
    </div>
  );
}

function SourceBadge({ source }: { source: string }) {
  return (
    <span className={`u-src ${source === 'local' ? 'u-src--local' : 'u-src--railway'}`}>{source}</span>
  );
}

function DailyBars({ daily }: { daily: { day: string; source: string; total_tokens: number; estimated_cost: number }[] }) {
  const byDay = new Map<string, { local: number; railway: number }>();
  for (const d of daily) {
    const k = new Date(d.day).toISOString().slice(0, 10);
    const entry = byDay.get(k) ?? { local: 0, railway: 0 };
    entry[d.source as 'local' | 'railway'] += Number(d.estimated_cost);
    byDay.set(k, entry);
  }
  const today = new Date();
  const keys: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    keys.push(d.toISOString().slice(0, 10));
  }
  const rows = keys.map((k) => [k, byDay.get(k) ?? { local: 0, railway: 0 }] as const);
  const max = Math.max(1, ...rows.map(([, v]) => v.local + v.railway));

  return (
    <div className="u-daily">
      <div className="u-daily-plot">
        {rows.map(([day, v]) => {
          const total = v.local + v.railway;
          const totalH = (total / max) * 100;
          const localH = total > 0 ? (v.local / total) * totalH : 0;
          const railwayH = totalH - localH;
          return (
            <div
              key={day}
              className="u-daily-col"
              title={`${day}: ${fmtCost(total)} (local ${fmtCost(v.local)}, railway ${fmtCost(v.railway)})`}
            >
              <span className="u-daily-tip">{fmtCost(total)}</span>
              <span className="u-daily-seg u-daily-seg--railway" style={{ height: `${railwayH}%` }} />
              <span className="u-daily-seg u-daily-seg--local" style={{ height: `${localH}%` }} />
            </div>
          );
        })}
      </div>
      <div className="u-daily-foot">
        <span>{rows[0][0]}</span>
        <div className="u-legend">
          <span className="u-legend-i"><span className="u-sw u-pat--solid" /> local</span>
          <span className="u-legend-i"><span className="u-sw u-pat--hatch" /> railway</span>
        </div>
        <span>{rows[rows.length - 1][0]}</span>
      </div>
    </div>
  );
}
