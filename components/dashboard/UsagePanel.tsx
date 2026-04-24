import { useMemo } from "react";
import { useClaudeUsage, UsageSession } from "../../hooks/useClaudeUsage";

function fmtTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${n}`;
}
function fmtCost(n: number): string { return `$${n.toFixed(2)}`; }
function shortProject(p: string): string { return p.replace(/^\/Users\/[^/]+\//, "~/"); }

export default function UsagePanel() {
  const { sessions, outliers, daily, projects, loading, error } = useClaudeUsage();

  const last7d = useMemo(() => {
    const cutoff = Date.now() - 7 * 86400_000;
    return sessions.filter(s => new Date(s.started_at).getTime() >= cutoff);
  }, [sessions]);

  const totals = useMemo(() => ({
    tokens7d: last7d.reduce((a, b) => a + b.total_tokens, 0),
    cost7d: last7d.reduce((a, b) => a + Number(b.estimated_cost), 0),
    sessionsLocal: last7d.filter(s => s.source === "local").length,
    sessionsRailway: last7d.filter(s => s.source === "railway").length,
  }), [last7d]);

  if (loading) return <div className="p-4 text-sm text-neutral-500">Loading usage…</div>;
  if (error) return <div className="p-4 text-sm text-red-600">Error: {error}</div>;

  return (
    <div className="flex flex-col gap-6 p-4">
      <div>
        <h2 className="font-serif italic text-3xl text-neutral-800">Claude Usage</h2>
        <p className="text-xs text-neutral-500 mt-1">
          Estimated cost is a signal for outlier detection — your Max plan bills flat.
          Sessions 2σ+ above the rolling 30-day mean are flagged.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="7d tokens" value={fmtTokens(totals.tokens7d)} />
        <Stat label="7d est. cost" value={fmtCost(totals.cost7d)} />
        <Stat label="Local sessions (7d)" value={String(totals.sessionsLocal)} />
        <Stat label="Railway sessions (7d)" value={String(totals.sessionsRailway)} />
      </div>

      <Section title={`Outliers (${outliers.length})`}>
        {outliers.length === 0 ? (
          <div className="text-sm text-neutral-500">No sessions beyond 2σ in the last 30 days.</div>
        ) : (
          <SessionsTable sessions={outliers} highlight />
        )}
      </Section>

      <Section title="By project (last 30d)">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-neutral-500">
            <th className="py-2">Project</th><th>Source</th><th>Sessions</th>
            <th>Tokens</th><th>Est. cost</th><th>Last</th>
          </tr></thead>
          <tbody>
            {projects.slice(0, 15).map((p, i) => (
              <tr key={i} className="border-t border-neutral-200">
                <td className="py-2">{shortProject(p.project_path)}</td>
                <td>{p.source}</td>
                <td>{p.session_count}</td>
                <td>{fmtTokens(p.total_tokens)}</td>
                <td>{fmtCost(Number(p.estimated_cost))}</td>
                <td className="text-neutral-500">{new Date(p.last_session).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Daily (last 30d)">
        <DailyBars daily={daily} />
      </Section>

      <Section title="Recent sessions">
        <SessionsTable sessions={sessions.slice(0, 25)} />
      </Section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-neutral-200 p-3">
      <div className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="font-serif italic text-2xl text-neutral-800 mt-1">{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-700 mb-2">{title}</h3>
      {children}
    </div>
  );
}

function SessionsTable({ sessions, highlight }: { sessions: UsageSession[]; highlight?: boolean }) {
  return (
    <table className="w-full text-sm">
      <thead><tr className="text-left text-neutral-500">
        <th className="py-2">When</th><th>Project</th><th>Source</th>
        <th>Model</th><th>Tokens</th><th>Cost</th>
      </tr></thead>
      <tbody>
        {sessions.map(s => (
          <tr key={s.id} className={`border-t border-neutral-200 ${highlight ? "bg-amber-50" : ""}`}>
            <td className="py-2 text-neutral-500">{new Date(s.started_at).toLocaleString()}</td>
            <td>{shortProject(s.project_path)}</td>
            <td>{s.source}</td>
            <td className="text-neutral-500">{s.primary_model}</td>
            <td>{fmtTokens(s.total_tokens)}</td>
            <td>{fmtCost(Number(s.estimated_cost))}</td>
          </tr>
        ))}
      </tbody>
    </table>
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
  const days = [...byDay.entries()].sort().slice(-30);
  const max = Math.max(1, ...days.map(([, v]) => v.local + v.railway));
  return (
    <div className="flex items-end gap-1 h-32">
      {days.map(([day, v]) => {
        const total = v.local + v.railway;
        const h = (total / max) * 100;
        const localH = (v.local / max) * 100;
        return (
          <div key={day} className="flex-1 flex flex-col justify-end" title={`${day}: $${total.toFixed(2)}`}>
            <div className="w-full" style={{ height: `${h - localH}%`, backgroundColor: "#6b8a6b" }} />
            <div className="w-full" style={{ height: `${localH}%`, backgroundColor: "#a3bba3" }} />
          </div>
        );
      })}
    </div>
  );
}
