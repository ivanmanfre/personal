import React from 'react';
import { Shell } from './Shell';
import {
  HeadRow, KpiRow, KpiTile, ActionGrid, ActionCard, SectionLabel,
  ToggleRow, BtnGhost, RowList, Row, ClientRow, Funnel, FunnelSeg,
  Pulse, PulseCell, Marginalia, ErrBanner, Card,
} from './primitives';
import type { NavItem, SectionId } from './types';

/**
 * Phase-0 demo. Renders every primitive once so we can verify visually
 * before building the real sections in phases 1-6.
 *
 * Mount via /dashboard-v2 route. Existing /dashboard is untouched.
 */
export default function DemoShell() {
  const navItems: NavItem[] = [
    { id: 'briefing', name: 'Briefing', emphasis: 'Briefing', num: '⊙', group: 'briefing', badge: { count: 3, severity: 'bad' } },
    { id: 'content', name: 'Content Studio', num: '01', group: 'operate', badge: { count: 2, severity: 'bad' } },
    { id: 'reach', name: 'Reach & Pipeline', num: '02', group: 'operate', badge: { count: 9, severity: 'warn' } },
    { id: 'ops', name: 'Operations', num: '03', group: 'operate', badge: { count: 6, severity: 'warn' } },
    { id: 'clients', name: 'Clients', num: '04', group: 'knowledge', badge: { count: 1, severity: 'bad' } },
    { id: 'knowledge', name: 'Knowledge', num: '05', group: 'knowledge' },
    { id: 'agent', name: 'Agent', num: '06', group: 'knowledge', badge: { count: 15, severity: 'warn' } },
    { id: 'personal', name: 'Personal', num: '07', group: 'personal' },
  ];

  const sectionRenderers: Partial<Record<SectionId, () => React.ReactNode>> = {
    briefing: () => (
      <>
        <HeadRow
          title={<>The Morning <em>Dispatch</em></>}
          chip={{ label: 'System Yellow', severity: 'warn' }}
          meta={<>Demo · Phase 0<br />v2 design system</>}
          live
        />
        <Pulse>
          <PulseCell name="Workflows" meta="31 ✓ · 6 err" severity="warn" />
          <PulseCell name="Posting" meta="2 fail · 1 stuck" severity="bad" />
          <PulseCell name="Lead Magnets" meta="down 30d" severity="bad" />
          <PulseCell name="Agent" meta="15 stuck" severity="warn" />
        </Pulse>
        <SectionLabel label="Action Required" alert count={3} />
        <ActionGrid>
          <ActionCard verb="Replay" when="May 6" head={<>Post failed: <em>"Most accounting firms…"</em></>} body="UniPile rejected the publish." cta={{ label: 'Retry now →' }} />
          <ActionCard verb="Reset" when="Stuck 16d" head={<>Post locked in <em>"posting"</em></>} body="Status never cleared." cta={{ label: 'Clear status →' }} />
          <ActionCard warn verb="Fix" when="Today" head={<>Apify <em>billing wall</em></>} body="Competitor scraper paused." cta={{ label: 'Open Apify →' }} />
        </ActionGrid>
        <SectionLabel label="Outreach Funnel" />
        <Funnel>
          <FunnelSeg label="Total" value={501} flex={5} variant="cold" />
          <FunnelSeg label="Identified" value={96} flex={1.2} variant="cold" />
          <FunnelSeg label="Conn sent" value={78} flex={1} variant="warm" />
          <FunnelSeg label="Warming" value={7} flex={0.6} variant="warm" />
          <FunnelSeg label="Connected" value={8} flex={0.6} variant="win" />
          <FunnelSeg label="DM sent" value={2} flex={0.5} variant="win" />
          <FunnelSeg label="Replied" value={1} flex={0.4} variant="win" />
        </Funnel>
        <KpiRow>
          <KpiTile label="Posts in queue" value="14" delta="Through May 16" />
          <KpiTile label="Engagement" value="2.0%" severity="good" delta="+0.4pp" deltaKind="up" />
          <KpiTile label="Leads · 7d" value="0" severity="bad" delta="zero" deltaKind="down" />
          <KpiTile label="Anthropic · 30d" value="$184" delta="+22% MoM" deltaKind="cost-up" />
        </KpiRow>
        <ErrBanner title="Apify quota hit." body="Cohort scrape paused 13 days." resolveLabel="Open Apify →" />
        <Marginalia variant="warn">
          <em>Comment engine silent.</em> Zero events in 7 days. Likely tied to Apify pause.
        </Marginalia>
        <Card label="Demo card" title={<>Primitives all <em>working</em></>}>
          <p>Every component in <code>primitives/</code> renders here. Hover, click, ⌘K to test the palette.</p>
        </Card>
        <RowList>
          <Row date="May 9" name="Don't automate lead gen first" tag="Text" />
          <Row date="May 11" name="Mid-market RevOps teams achieve clean CRM pipelines" tag="Caro" />
          <Row date="May 6" name="Most accounting firms…" tag="Fail" variant="failed" />
        </RowList>
        <SectionLabel label="Clients" />
        <RowList>
          <ClientRow name="Ivan System" status="3 errors · n8n.ivanmanfredi.com" severity="bad" action="Open log →" />
          <ClientRow name="ProSWPPP" status="3 errors · proswppp" severity="warn" action="Open →" />
          <ClientRow name="Lemonade" status="healthy · 12m" severity="good" action="Open →" />
        </RowList>
        <SectionLabel label="Toggles" />
        <ToggleRow label="Auto-fix engine" desc="Apply safe_to_fix errors automatically" on={true} onChange={() => {}} />
        <div style={{ marginTop: '0.5rem' }} />
        <ToggleRow label="Pause all outreach" desc="Stops connection sender + DM sequence" on={false} onChange={() => {}} />
        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
          <BtnGhost>Default</BtnGhost>
          <BtnGhost variant="dim">Dim</BtnGhost>
          <BtnGhost variant="good">Approve</BtnGhost>
          <BtnGhost variant="bad">Reject</BtnGhost>
        </div>
      </>
    ),
  };

  return <Shell navItems={navItems} sectionRenderers={sectionRenderers} />;
}
