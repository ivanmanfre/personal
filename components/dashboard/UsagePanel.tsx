import { useMemo } from "react";
import { Activity, Zap, AlertTriangle, Database, Cpu, FolderOpen } from "lucide-react";
import { useClaudeUsage, UsageSession } from "../../hooks/useClaudeUsage";

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
function shortProject(p: string): string {
  return p.replace(/^\/Users\/[^/]+\//, "~/").replace(/^\/private\/tmp\//, "/tmp/");
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

function modelColor(m: string): string {
  if (m.startsWith("claude-opus")) return "text-purple-400";
  if (m.startsWith("claude-sonnet")) return "text-cyan-400";
  if (m.startsWith("claude-haiku")) return "text-emerald-400";
  return "text-zinc-400";
}

function zScores(sessions: UsageSession[]): Map<string, number> {
  const map = new Map<string, number>();
  if (sessions.length < 5) return map;
  const costs = sessions.map(s => Number(s.estimated_cost));
  const mean = costs.reduce((a, b) => a + b, 0) / costs.length;
  const variance = costs.reduce((a, b) => a + (b - mean) ** 2, 0) / costs.length;
  const sd = Math.sqrt(variance);
  if (sd === 0) return map;
  for (const s of sessions) map.set(s.id, (Number(s.estimated_cost) - mean) / sd);
  return map;
}

export default function UsagePanel() {
  const { sessions, daily, projects, loading, error } = useClaudeUsage();

  const last30dCost = useMemo(
    () => sessions.reduce((a, b) => a + Number(b.estimated_cost), 0),
    [sessions]
  );
  const last7dCost = useMemo(() => {
    const cutoff = Date.now() - 7 * 86400_000;
    return sessions
      .filter(s => new Date(s.started_at).getTime() >= cutoff)
      .reduce((a, b) => a + Number(b.estimated_cost), 0);
  }, [sessions]);
  const leverage = last30dCost / MAX_PLAN_USD;

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

  const zMap = useMemo(() => zScores(sessions), [sessions]);
  const topSessions = useMemo(
    () => [...sessions].sort((a, b) => Number(b.estimated_cost) - Number(a.estimated_cost)).slice(0, 15),
    [sessions]
  );

  if (loading) {
    return (
      <div className="p-6 text-sm text-zinc-500">Loading usage…</div>
    );
  }
  if (error) {
    return (
      <div className="p-6 text-sm text-red-400">Error: {error}</div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 max-w-7xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Claude Usage</h1>
        <p className="text-xs text-zinc-500 mt-1">
          Where your tokens go. Costs are API-rate equivalent — your Max plan bills{" "}
          <span className="text-zinc-300">${MAX_PLAN_USD}/mo flat</span>, so this is leverage, not a bill.
        </p>
      </div>

      {/* Hero stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="30d API equiv" value={fmtCost(last30dCost)} accent="text-emerald-400" sub={`${leverage.toFixed(0)}× your $${MAX_PLAN_USD} plan`} icon={<Zap className="w-4 h-4" />} />
        <Stat label="7d API equiv" value={fmtCost(last7dCost)} accent="text-zinc-200" sub={`${sessions.filter(s => new Date(s.started_at).getTime() >= Date.now() - 7 * 86400_000).length} sessions`} icon={<Activity className="w-4 h-4" />} />
        <Stat label="Top model" value={byModel[0]?.[0]?.replace("claude-", "") ?? "—"} accent={byModel[0] ? modelColor(byModel[0][0]) : "text-zinc-300"} sub={byModel[0] ? `${fmtCost(byModel[0][1].cost)} • ${((byModel[0][1].cost / last30dCost) * 100).toFixed(0)}%` : ""} icon={<Cpu className="w-4 h-4" />} />
        <Stat label="Top project" value={shortProject(projects[0]?.project_path ?? "—")} accent="text-zinc-200" sub={projects[0] ? `${fmtCost(Number(projects[0].estimated_cost))} • ${projects[0].session_count} sessions` : ""} icon={<FolderOpen className="w-4 h-4" />} />
      </div>

      {/* Daily bars */}
      <Card>
        <SectionHeader title="Daily spend (30d)" subtitle="API-rate equivalent per day, stacked local + railway" />
        <DailyBars daily={daily} />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* By model */}
        <Card>
          <SectionHeader title="Where the cost goes — by model" subtitle="Output is 5× input. Opus output is 25× Haiku output." icon={<Cpu className="w-4 h-4 text-zinc-500" />} />
          <div className="flex flex-col gap-2">
            {byModel.map(([model, v]) => {
              const pct = (v.cost / last30dCost) * 100;
              return (
                <div key={model} className="flex flex-col gap-1">
                  <div className="flex justify-between items-baseline text-sm">
                    <span className={`font-medium ${modelColor(model)}`}>{model.replace("claude-", "")}</span>
                    <span className="text-zinc-300 tabular-nums">{fmtCost(v.cost)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-zinc-800/60 rounded-full overflow-hidden">
                      <div className={`h-full ${modelColor(model).replace("text-", "bg-")}/40`} style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                    <span className="text-[11px] text-zinc-500 tabular-nums w-20 text-right">{pct.toFixed(0)}% • {v.sessions} sess</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Token mix */}
        <Card>
          <SectionHeader title="Token mix (30d)" subtitle="Cache reads are 10× cheaper than fresh input. Cache writes are 1.25× input — that's where Opus gets expensive." icon={<Database className="w-4 h-4 text-zinc-500" />} />
          <div className="flex flex-col gap-3">
            <TokenBar label="Cache reads" tokens={tokenMix.cacheRead.tokens} pct={tokenMix.cacheRead.pct} color="bg-emerald-500/40" textColor="text-emerald-300" />
            <TokenBar label="Cache writes" tokens={tokenMix.cacheWrite.tokens} pct={tokenMix.cacheWrite.pct} color="bg-amber-500/40" textColor="text-amber-300" />
            <TokenBar label="Output" tokens={tokenMix.output.tokens} pct={tokenMix.output.pct} color="bg-purple-500/40" textColor="text-purple-300" />
            <TokenBar label="Fresh input" tokens={tokenMix.input.tokens} pct={tokenMix.input.pct} color="bg-cyan-500/40" textColor="text-cyan-300" />
          </div>
        </Card>
      </div>

      {/* By project */}
      <Card>
        <SectionHeader title="By project (30d)" subtitle="Sorted by API-equivalent cost" icon={<FolderOpen className="w-4 h-4 text-zinc-500" />} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-zinc-500">
                <th className="py-2 font-medium">Project</th>
                <th className="font-medium">Source</th>
                <th className="font-medium text-right">Sessions</th>
                <th className="font-medium text-right">Tokens</th>
                <th className="font-medium text-right">API equiv</th>
                <th className="font-medium text-right">Last</th>
              </tr>
            </thead>
            <tbody>
              {projects.slice(0, 12).map((p, i) => (
                <tr key={i} className="border-t border-zinc-800/40 hover:bg-zinc-800/20">
                  <td className="py-2 text-zinc-200 truncate max-w-md" title={p.project_path}>{shortProject(p.project_path)}</td>
                  <td><SourceBadge source={p.source} /></td>
                  <td className="text-right text-zinc-400 tabular-nums">{p.session_count}</td>
                  <td className="text-right text-zinc-400 tabular-nums">{fmtTokens(p.total_tokens)}</td>
                  <td className="text-right text-zinc-200 tabular-nums">{fmtCost(Number(p.estimated_cost))}</td>
                  <td className="text-right text-zinc-500 tabular-nums">{timeAgo(p.last_session)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Top sessions */}
      <Card>
        <SectionHeader title="Top 15 sessions by cost" subtitle="Outliers (z ≥ 2σ) flagged. Click model/project to see what burned through tokens." icon={<AlertTriangle className="w-4 h-4 text-zinc-500" />} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-zinc-500">
                <th className="py-2 font-medium">When</th>
                <th className="font-medium">Project</th>
                <th className="font-medium">Model</th>
                <th className="font-medium text-right">Tokens</th>
                <th className="font-medium text-right">API equiv</th>
                <th className="font-medium text-right">σ</th>
              </tr>
            </thead>
            <tbody>
              {topSessions.map(s => {
                const z = zMap.get(s.id) ?? 0;
                const isOutlier = z >= 2;
                return (
                  <tr key={s.id} className={`border-t border-zinc-800/40 hover:bg-zinc-800/20 ${isOutlier ? "bg-amber-500/[0.04]" : ""}`}>
                    <td className="py-2 text-zinc-400 tabular-nums whitespace-nowrap">{timeAgo(s.started_at)}</td>
                    <td className="text-zinc-200 truncate max-w-xs" title={s.project_path}>{shortProject(s.project_path)}</td>
                    <td className={modelColor(s.primary_model)}>{s.primary_model.replace("claude-", "")}</td>
                    <td className="text-right text-zinc-400 tabular-nums">{fmtTokens(s.total_tokens)}</td>
                    <td className="text-right text-zinc-200 tabular-nums">{fmtCost(Number(s.estimated_cost))}</td>
                    <td className="text-right tabular-nums">
                      {isOutlier ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          {z.toFixed(1)}σ
                        </span>
                      ) : (
                        <span className="text-zinc-600">{z.toFixed(1)}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl shadow-sm shadow-black/10 p-4">
      {children}
    </div>
  );
}

function SectionHeader({ title, subtitle, icon }: { title: string; subtitle?: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-3">
      <div className="flex items-start gap-2">
        {icon}
        <div>
          <h3 className="text-sm font-semibold text-zinc-200">{title}</h3>
          {subtitle && <p className="text-[11px] text-zinc-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent, sub, icon }: { label: string; value: string; accent: string; sub?: string; icon?: React.ReactNode }) {
  return (
    <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl p-3 shadow-sm shadow-black/10">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-zinc-500">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`text-2xl font-semibold tabular-nums mt-1 ${accent}`}>{value}</div>
      {sub && <div className="text-[11px] text-zinc-500 mt-1 truncate" title={sub}>{sub}</div>}
    </div>
  );
}

function TokenBar({ label, tokens, pct, color, textColor }: { label: string; tokens: number; pct: number; color: string; textColor: string }) {
  return (
    <div>
      <div className="flex justify-between items-baseline text-sm mb-1">
        <span className={`font-medium ${textColor}`}>{label}</span>
        <span className="text-zinc-400 tabular-nums text-xs">{fmtTokens(tokens)} • {pct.toFixed(1)}%</span>
      </div>
      <div className="h-2 bg-zinc-800/60 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}

function SourceBadge({ source }: { source: string }) {
  const cls = source === "local"
    ? "bg-blue-500/15 text-blue-300 border-blue-500/30"
    : "bg-purple-500/15 text-purple-300 border-purple-500/30";
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${cls}`}>
      {source}
    </span>
  );
}

function DailyBars({ daily }: { daily: { day: string; source: string; total_tokens: number; estimated_cost: number }[] }) {
  const byDay = new Map<string, { local: number; railway: number }>();
  for (const d of daily) {
    const k = new Date(d.day).toISOString().slice(0, 10);
    const entry = byDay.get(k) ?? { local: 0, railway: 0 };
    entry[d.source as "local" | "railway"] += Number(d.estimated_cost);
    byDay.set(k, entry);
  }
  // Fill missing days for last 30
  const today = new Date();
  const keys: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    keys.push(d.toISOString().slice(0, 10));
  }
  const rows = keys.map(k => [k, byDay.get(k) ?? { local: 0, railway: 0 }] as const);
  const max = Math.max(1, ...rows.map(([, v]) => v.local + v.railway));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-1 h-40">
        {rows.map(([day, v]) => {
          const total = v.local + v.railway;
          const totalH = (total / max) * 100;
          const localH = total > 0 ? (v.local / total) * totalH : 0;
          const railwayH = totalH - localH;
          return (
            <div
              key={day}
              className="flex-1 flex flex-col justify-end group relative cursor-default"
              title={`${day}: ${fmtCost(total)} (local ${fmtCost(v.local)}, railway ${fmtCost(v.railway)})`}
            >
              <div className="w-full bg-purple-500/40 group-hover:bg-purple-400/60 transition-colors" style={{ height: `${railwayH}%` }} />
              <div className="w-full bg-blue-500/50 group-hover:bg-blue-400/70 transition-colors" style={{ height: `${localH}%` }} />
              <div className="absolute inset-x-0 -top-6 text-center text-[9px] text-zinc-300 opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap tabular-nums">
                {fmtCost(total)}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between text-[10px] text-zinc-500">
        <span>{rows[0][0]}</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-500/50 rounded-sm" /> local</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-purple-500/40 rounded-sm" /> railway</span>
        </div>
        <span>{rows[rows.length - 1][0]}</span>
      </div>
    </div>
  );
}
