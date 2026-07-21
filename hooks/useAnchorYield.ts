import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// ── Anchor-engager yield ─────────────────────────────────────────────────────
// One row per harvest anchor (Kyle, Paolo, the agency-ops coach cluster, …):
// how many people their orbit produced, how dense the ICP is, and how the
// sendable ones are converting. Ground-truth: outreach_prospects rows whose
// trigger_detail is `icp_authority:<Anchor> — <comment|reaction> on <url>`.
//
// The main pipeline hook only pulls 500 non-archived prospects; the anchor
// population is ~2.6k incl. archived, so this fetches its own paginated slice
// (only the columns needed for the aggregate) rather than reusing that array.

export interface AnchorYieldRow {
  anchor: string;
  active: boolean;          // in the roster + active flag (harvested on schedule)
  inRoster: boolean;        // present in the roster config at all
  reactionsEnabled: boolean;// roster harvests this anchor's reactors, not just commenters
  harvested: number;        // total prospects sourced from this anchor
  pending: number;          // awaiting the re-score drainer (icp not settled yet)
  scored: number;           // harvested − pending
  sendable: number;         // icp_score ≥ 7
  passRatePct: number | null; // sendable / scored (null until anything scored)
  fromReactions: number;    // sourced from a reaction (vs a comment)
  sent: number;             // connection invite sent
  accepted: number;         // invite accepted (connected)
  acceptRatePct: number | null; // accepted / sent, gated on ≥5 sent (small-N noise)
  replied: number;          // has replied at least once
}

export interface AnchorYield {
  rows: AnchorYieldRow[];
  totals: { harvested: number; scored: number; sendable: number; sent: number; accepted: number; replied: number };
  lastRunAt: string | null; // most recent bi-weekly harvester run
  loading: boolean;
}

// Name capture terminates at the em-dash (or a plain hyphen fallback) that the
// harvester's note-builder inserts before comment|reaction. The source suffix is
// optional: legacy LM-anchor-lane rows are the bare `icp_authority:<Name>` form
// (no "— comment on <url>"), and dropping them would under-count the anchor.
const ANCHOR_RE = /^icp_authority:\s*(.+?)(?:\s+[-—]\s+(comment|reaction)\s+on\b.*)?$/;

const PAGE = 1000;

interface RawRow {
  trigger_detail: string | null;
  icp_score: number | null;
  skip_reason: string | null;
  connection_sent_at: string | null;
  connected_at: string | null;
  last_reply_at: string | null;
  reply_count: number | null;
}

const emptyTotals = { harvested: 0, scored: 0, sendable: 0, sent: 0, accepted: 0, replied: 0 };

export function useAnchorYield(): AnchorYield & { refresh: () => Promise<void> } {
  const [state, setState] = useState<AnchorYield>({
    rows: [], totals: { ...emptyTotals }, lastRunAt: null, loading: true,
  });

  const fetchYield = useCallback(async () => {
    try {
      // 1. Roster (active/reactions flags). Stored as a JSON string in value.
      const rosterPromise = supabase
        .from('integration_config')
        .select('value')
        .eq('key', 'anchor_harvest_roster')
        .maybeSingle();

      // 2. Latest harvester run (for the "last harvested" line).
      const runPromise = supabase
        .from('outreach_engagement_log')
        .select('created_at')
        .eq('action_type', 'anchor_harvest_run')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // 3. Full anchor population, paginated (only the aggregate columns).
      const rows: RawRow[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from('outreach_prospects')
          .select('trigger_detail, icp_score, skip_reason, connection_sent_at, connected_at, last_reply_at, reply_count')
          .like('trigger_detail', 'icp_authority%')
          .order('created_at', { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const batch = (data || []) as RawRow[];
        rows.push(...batch);
        if (batch.length < PAGE) break;
      }

      const [{ data: rosterData }, { data: runData }] = await Promise.all([rosterPromise, runPromise]);

      // Parse roster config.
      const roster: { name: string; active?: boolean; reactions?: boolean }[] = (() => {
        const raw = rosterData?.value;
        if (!raw) return [];
        try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return []; }
      })();
      const rosterByName = new Map(roster.map((r) => [r.name, r]));

      // Aggregate per anchor.
      const acc = new Map<string, AnchorYieldRow>();
      const blank = (anchor: string): AnchorYieldRow => {
        const rr = rosterByName.get(anchor);
        return {
          anchor,
          active: rr?.active === true,
          inRoster: !!rr,
          reactionsEnabled: rr?.reactions === true,
          harvested: 0, pending: 0, scored: 0, sendable: 0, passRatePct: null,
          fromReactions: 0, sent: 0, accepted: 0, acceptRatePct: null, replied: 0,
        };
      };

      for (const r of rows) {
        const m = r.trigger_detail?.match(ANCHOR_RE);
        if (!m) continue;
        const anchor = m[1].trim();
        const kind = m[2];
        let row = acc.get(anchor);
        if (!row) { row = blank(anchor); acc.set(anchor, row); }
        row.harvested += 1;
        if (kind === 'reaction') row.fromReactions += 1;
        const isPending = r.skip_reason === 'needs_rescore';
        if (isPending) row.pending += 1;
        else {
          row.scored += 1;
          if ((r.icp_score ?? 0) >= 7) row.sendable += 1;
        }
        if (r.connection_sent_at) row.sent += 1;
        if (r.connected_at) row.accepted += 1;
        if (r.last_reply_at || (r.reply_count ?? 0) > 0) row.replied += 1;
      }

      // Roster anchors with zero rows yet (e.g. Zane) still deserve a row.
      for (const rr of roster) if (!acc.has(rr.name)) acc.set(rr.name, blank(rr.name));

      const out = Array.from(acc.values());
      for (const row of out) {
        row.passRatePct = row.scored > 0 ? Math.round((row.sendable / row.scored) * 1000) / 10 : null;
        row.acceptRatePct = row.sent >= 5 ? Math.round((row.accepted / row.sent) * 1000) / 10 : null;
      }
      // Most productive anchors first (sendable, then raw yield).
      out.sort((a, b) => b.sendable - a.sendable || b.harvested - a.harvested);

      const totals = out.reduce((t, r) => ({
        harvested: t.harvested + r.harvested,
        scored: t.scored + r.scored,
        sendable: t.sendable + r.sendable,
        sent: t.sent + r.sent,
        accepted: t.accepted + r.accepted,
        replied: t.replied + r.replied,
      }), { ...emptyTotals });

      setState({ rows: out, totals, lastRunAt: runData?.created_at ?? null, loading: false });
    } catch {
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  useEffect(() => { fetchYield(); }, [fetchYield]);

  return { ...state, refresh: fetchYield };
}
